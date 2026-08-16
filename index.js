const functions = require("firebase-functions");
const admin = require("firebase-admin");
admin.initializeApp();
const db = admin.firestore();

/**
 * 1. Securely Starts an Exam Attempt
 * Fetches question pool, generates a deterministic randomized order, strips answer keys, 
 * and binds the attempt to a single server-side session.
 */
exports.startExamAttempt = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "User must be authenticated.");
  }

  const { examId, sessionId } = data;
  const uid = context.auth.uid;

  const userDoc = await db.collection("users").doc(uid).get();
  if (!userDoc.exists) throw new functions.https.HttpsError("not-found", "User profile missing.");
  const userData = userDoc.data();

  const examDoc = await db.collection("exams").doc(examId).get();
  if (!examDoc.exists) throw new functions.https.HttpsError("not-found", "Exam missing.");
  const exam = examDoc.data();

  if (exam.instituteId !== userData.instituteId) {
    throw new functions.https.HttpsError("permission-denied", "Cross-institute violation detected.");
  }

  const now = admin.firestore.Timestamp.now();
  if (now < exam.startWindow || now > exam.endWindow) {
    throw new functions.https.HttpsError("failed-precondition", "Exam window is inactive.");
  }

  // Check for existing active attempt
  const existingAttempts = await db.collection("examAttempts")
    .where("studentId", "==", uid)
    .where("examId", "==", examId)
    .where("status", "==", "IN_PROGRESS")
    .get();

  if (!existingAttempts.empty) {
    const activeAttempt = existingAttempts.docs[0].data();
    // Enforce single-session active device check
    if (activeAttempt.activeSessionId && activeAttempt.activeSessionId !== sessionId) {
      await db.collection("securityEvents").add({
        attemptId: activeAttempt.attemptId,
        examId,
        studentId: uid,
        instituteId: userData.instituteId,
        eventType: "MULTIPLE_SESSION",
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        metadata: { newSessionId: sessionId }
      });
      throw new functions.https.HttpsError("already-exists", "Active session already running on another device/tab.");
    }
    return { attemptId: existingAttempts.docs[0].id, alreadyStarted: true };
  }

  // Fetch question pool
  const qSnap = await db.collection("questions")
    .where("examId", "==", examId)
    .where("instituteId", "==", userData.instituteId)
    .get();

  if (qSnap.empty) throw new functions.https.HttpsError("failed-precondition", "Question pool empty.");

  let allQuestions = qSnap.docs.map(doc => doc.id);
  // Fisher-Yates shuffle
  for (let i = allQuestions.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [allQuestions[i], allQuestions[j]] = [allQuestions[j], allQuestions[i]];
  }

  const selectedQuestions = allQuestions.slice(0, exam.displayQuestionCount || allQuestions.length);

  const attemptRef = db.collection("examAttempts").doc();
  const attemptData = {
    attemptId: attemptRef.id,
    studentId: uid,
    instituteId: userData.instituteId,
    examId,
    status: "IN_PROGRESS",
    attemptStartTime: admin.firestore.FieldValue.serverTimestamp(),
    attemptEndTime: admin.firestore.Timestamp.fromMillis(Date.now() + exam.durationMinutes * 60000),
    questionOrder: selectedQuestions,
    answers: {},
    activeSessionId: sessionId,
    totalViolations: 0
  };

  await attemptRef.set(attemptData);
  return { attemptId: attemptRef.id, alreadyStarted: false };
});

/**
 * 2. Secure Question Fetcher (Strips Answers)
 */
exports.getAttemptQuestions = functions.https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError("unauthenticated", "Authentication required.");

  const { attemptId } = data;
  const attemptDoc = await db.collection("examAttempts").doc(attemptId).get();
  
  if (!attemptDoc.exists) throw new functions.https.HttpsError("not-found", "Attempt not found.");
  const attempt = attemptDoc.data();

  if (attempt.studentId !== context.auth.uid) {
    throw new functions.https.HttpsError("permission-denied", "Unauthorized attempt access.");
  }

  const questionDocs = await Promise.all(
    attempt.questionOrder.map(qId => db.collection("questions").doc(qId).get())
  );

  const sanitizedQuestions = questionDocs.map(doc => {
    const qData = doc.data();
    return {
      id: doc.id,
      questionText: qData.questionText,
      options: qData.options.map(o => ({ id: o.id, text: o.text })),
      marks: qData.marks
      // Correct answer and explanation stripped out
    };
  });

  return { questions: sanitizedQuestions, attemptEndTime: attempt.attemptEndTime, answers: attempt.answers };
});

/**
 * 3. Server-Side Submission & Score Calculation
 */
exports.submitExamAttempt = functions.https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError("unauthenticated", "Auth required.");

  const { attemptId, answers } = data;
  const attemptRef = db.collection("examAttempts").doc(attemptId);
  const attemptDoc = await attemptRef.get();

  if (!attemptDoc.exists) throw new functions.https.HttpsError("not-found", "Attempt invalid.");
  const attempt = attemptDoc.data();

  if (attempt.studentId !== context.auth.uid) throw new functions.https.HttpsError("permission-denied", "Access denied.");
  if (attempt.status !== "IN_PROGRESS") throw new functions.https.HttpsError("failed-precondition", "Attempt already closed.");

  const examDoc = await db.collection("exams").doc(attempt.examId).get();
  const exam = examDoc.data();

  const qSnap = await db.collection("questions").where("examId", "==", attempt.examId).get();
  const qMap = {};
  qSnap.docs.forEach(doc => { qMap[doc.id] = doc.data(); });

  let score = 0;
  let correctCount = 0;
  let wrongCount = 0;
  let unansweredCount = 0;

  attempt.questionOrder.forEach(qId => {
    const studentAns = answers[qId];
    const q = qMap[qId];

    if (!studentAns) {
      unansweredCount++;
    } else if (studentAns === q.correctAnswer) {
      score += (q.marks || exam.positiveMarks || 1);
      correctCount++;
    } else {
      score -= (exam.negativeMarks || 0);
      wrongCount++;
    }
  });

  const totalPossible = attempt.questionOrder.length * (exam.positiveMarks || 1);
  const percentage = (score / totalPossible) * 100;

  const updatePayload = {
    answers,
    score: Math.max(0, score),
    percentage: Math.max(0, percentage),
    status: data.isAutoSubmit ? "AUTO_SUBMITTED" : "SUBMITTED",
    submittedAt: admin.firestore.FieldValue.serverTimestamp(),
    breakdown: { correctCount, wrongCount, unansweredCount }
  };

  await attemptRef.update(updatePayload);
  return { success: true, score: updatePayload.score, percentage: updatePayload.percentage };
});