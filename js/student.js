// ============================================================
// STUDENT EXAM PORTAL
// Firebase + Firestore
// Existing index.html design preserved
// ============================================================

import { auth, db } from "./firebase-config.js";

import {
    collection,
    doc,
    getDoc,
    getDocs,
    query,
    where,
    addDoc,
    setDoc,
    updateDoc,
    serverTimestamp,
    onSnapshot
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";


// ============================================================
// DOM HELPERS
// ============================================================

const $ = (id) => document.getElementById(id);

const loginScreen = $("loginScreen");
const instructionScreen = $("instructionScreen");
const examScreen = $("examScreen");

const candidateNameInput = $("candidateName");
const candidateEmailInput = $("candidateEmail");

const loginBtn = $("loginBtn");
const backToLoginBtn = $("backToLoginBtn");

const instructionAgreement = $("instructionAgreement");
const startTestBtn = $("startTestBtn");

const startTestModal = $("startTestModal");
const cancelStartBtn = $("cancelStartBtn");
const confirmStartBtn = $("confirmStartBtn");

const examTimer = $("examTimer");
const questionNumber = $("questionNumber");
const saveNextBtn = $("saveNextBtn");
const previousBtn = $("previousBtn");

const questionText = document.querySelector(".question-text");
const optionButtons = document.querySelectorAll(".option");


// ============================================================
// STATE
// ============================================================

let candidate = {
    name: "",
    email: ""
};

let examSettings = null;
let questions = [];
let currentQuestionIndex = 0;

let answers = {};

let timerInterval = null;
let remainingSeconds = 0;

let examStarted = false;
let examSubmitted = false;

let attemptId = null;

let violationCount = 0;
let securityPenalty = 0;

let settingsUnsubscribe = null;

let questionStartTime = null;


// ============================================================
// DEFAULTS
// Only fallback values.
// Important live configuration comes from Firestore.
// ============================================================

const DEFAULT_SETTINGS = {
    examTitle: "Online Examination",
    totalQuestions: 100,
    questionsToDisplay: 80,
    durationMinutes: 60,
    marksPerQuestion: 4,
    negativeMarks: 1,
    tabSwitchPenalty: 1,
    maxTabSwitches: 2,
    randomQuestions: true,
    randomOptions: true,
    disableCopy: true,
    disablePaste: true,
    disableScreenshot: true,
    disableRefresh: true,
    disableFunctionKeys: true,
    examStatus: "draft"
};


// ============================================================
// UTILITY
// ============================================================

function normalizeEmail(email) {
    return String(email || "")
        .trim()
        .toLowerCase();
}


function escapeHTML(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}


function shuffle(array) {
    const copy = [...array];

    for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));

        [copy[i], copy[j]] = [copy[j], copy[i]];
    }

    return copy;
}


function showScreen(screen) {
    document.querySelectorAll(".screen").forEach((item) => {
        item.classList.remove("active");
    });

    if (screen) {
        screen.classList.add("active");
    }
}


function formatTime(seconds) {
    const safeSeconds = Math.max(0, seconds);

    const minutes = Math.floor(safeSeconds / 60);
    const secs = safeSeconds % 60;

    return `${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}


function showMessage(message) {
    console.log("[Exam]", message);
}


// ============================================================
// FIRESTORE EXAM SETTINGS
// Real-time listener
// ============================================================

function listenExamSettings() {

    const settingsRef = doc(
        db,
        "examSettings",
        "current"
    );

    settingsUnsubscribe = onSnapshot(
        settingsRef,
        (snapshot) => {

            if (!snapshot.exists()) {

                examSettings = {
                    ...DEFAULT_SETTINGS
                };

                applySettingsToUI();

                return;
            }

            examSettings = {
                ...DEFAULT_SETTINGS,
                ...snapshot.data()
            };

            applySettingsToUI();

            console.log(
                "Exam settings updated:",
                examSettings
            );

            if (
                examStarted &&
                !examSubmitted &&
                examSettings.examStatus === "ended"
            ) {
                submitExam("admin_force_submit");
            }

        },
        (error) => {

            console.error(
                "Exam settings listener error:",
                error
            );

            examSettings = {
                ...DEFAULT_SETTINGS
            };

            applySettingsToUI();
        }
    );
}


// ============================================================
// APPLY SETTINGS TO EXISTING DESIGN
// ============================================================

function applySettingsToUI() {

    if (!examSettings) return;

    const questionCount =
        Number(examSettings.questionsToDisplay) ||
        DEFAULT_SETTINGS.questionsToDisplay;

    const duration =
        Number(examSettings.durationMinutes) ||
        DEFAULT_SETTINGS.durationMinutes;

    const marks =
        Number(examSettings.marksPerQuestion) ||
        DEFAULT_SETTINGS.marksPerQuestion;

    const negative =
        Number(examSettings.negativeMarks) ||
        DEFAULT_SETTINGS.negativeMarks;


    const instructionQuestions =
        $("instructionQuestions");

    const instructionDuration =
        $("instructionDuration");

    const instructionMarks =
        $("instructionMarks");

    const instructionNegative =
        $("instructionNegative");


    if (instructionQuestions) {
        instructionQuestions.textContent =
            questionCount;
    }

    if (instructionDuration) {
        instructionDuration.textContent =
            `${duration} Minutes`;
    }

    if (instructionMarks) {
        instructionMarks.textContent =
            `+${marks}`;
    }

    if (instructionNegative) {
        instructionNegative.textContent =
            `-${negative}`;
    }


    const examTitle =
        document.querySelector(".exam-title h1");

    if (examTitle && examSettings.examTitle) {
        examTitle.textContent =
            examSettings.examTitle;
    }
}


// ============================================================
// EXAM STATUS
// ============================================================

function isExamLive() {

    if (!examSettings) {
        return false;
    }

    const status =
        String(
            examSettings.examStatus || "draft"
        ).toLowerCase();


    if (status === "live") {
        return true;
    }

    return false;
}


// ============================================================
// CHECK ONE EMAIL = ONE ATTEMPT
// ============================================================

async function hasPreviousAttempt(email) {

    const normalizedEmail =
        normalizeEmail(email);

    if (!normalizedEmail) {
        return false;
    }


    try {

        const candidatesRef =
            collection(db, "candidates");

        const candidateQuery =
            query(
                candidatesRef,
                where(
                    "email",
                    "==",
                    normalizedEmail
                )
            );

        const candidateSnapshot =
            await getDocs(candidateQuery);


        for (
            const candidateDoc
            of candidateSnapshot.docs
        ) {

            const data =
                candidateDoc.data();

            const status =
                String(
                    data.status || ""
                ).toLowerCase();


            if (
                status === "completed" ||
                status === "auto_submitted" ||
                status === "submitted" ||
                status === "disqualified"
            ) {
                return true;
            }
        }


        return false;

    } catch (error) {

        console.error(
            "Previous attempt check failed:",
            error
        );

        throw error;
    }
}


// ============================================================
// CANDIDATE LOGIN
// ============================================================

if (loginBtn) {

    loginBtn.addEventListener(
        "click",
        async () => {

            const name =
                candidateNameInput?.value
                    ?.trim() || "";

            const email =
                normalizeEmail(
                    candidateEmailInput?.value
                );


            if (!name) {

                showMessage(
                    "Please enter your full name."
                );

                candidateNameInput?.focus();

                return;
            }


            if (!email) {

                showMessage(
                    "Please enter your email address."
                );

                candidateEmailInput?.focus();

                return;
            }


            if (
                !/^[^\s@]+@[^\s@]+\.[^\s@]+$/
                    .test(email)
            ) {

                showMessage(
                    "Please enter a valid email address."
                );

                candidateEmailInput?.focus();

                return;
            }


            if (!examSettings) {

                showMessage(
                    "Exam configuration is still loading. Please wait."
                );

                return;
            }


            if (!isExamLive()) {

                const status =
                    String(
                        examSettings.examStatus ||
                        "draft"
                    ).toLowerCase();


                if (status === "scheduled") {

                    showMessage(
                        "Examination has not started yet."
                    );

                } else if (status === "paused") {

                    showMessage(
                        "Examination is currently paused."
                    );

                } else if (
                    status === "ended" ||
                    status === "completed"
                ) {

                    showMessage(
                        "Examination has ended."
                    );

                } else {

                    showMessage(
                        "Examination is not currently live."
                    );
                }

                return;
            }


            loginBtn.disabled = true;

            const originalText =
                loginBtn.textContent;

            loginBtn.textContent =
                "Checking...";


            try {

                const alreadyAttempted =
                    await hasPreviousAttempt(
                        email
                    );


                if (alreadyAttempted) {

                    showMessage(
                        "This email has already completed an examination attempt."
                    );

                    return;
                }


                candidate = {
                    name,
                    email
                };


                await createCandidateRecord();


                showScreen(
                    instructionScreen
                );


            } catch (error) {

                console.error(
                    "Candidate login error:",
                    error
                );

                showMessage(
                    "Unable to verify your examination access. Please try again."
                );

            } finally {

                loginBtn.disabled = false;

                loginBtn.textContent =
                    originalText;
            }
        }
    );
}


// ============================================================
// CREATE CANDIDATE RECORD
// ============================================================

async function createCandidateRecord() {

    const candidateRef =
        doc(
            db,
            "candidates",
            candidate.email
        );


    const existing =
        await getDoc(candidateRef);


    if (
        existing.exists() &&
        [
            "completed",
            "auto_submitted",
            "submitted",
            "disqualified"
        ].includes(
            String(
                existing.data().status || ""
            ).toLowerCase()
        )
    ) {

        throw new Error(
            "Candidate already attempted the examination."
        );
    }


    await setDoc(
        candidateRef,
        {
            name: candidate.name,
            email: candidate.email,

            status: "not_started",

            loginTime:
                serverTimestamp(),

            updatedAt:
                serverTimestamp()
        },
        {
            merge: true
        }
    );
}


// ============================================================
// BACK TO LOGIN
// ============================================================

if (backToLoginBtn) {

    backToLoginBtn.addEventListener(
        "click",
        () => {

            candidate = {
                name: "",
                email: ""
            };

            if (candidateNameInput) {
                candidateNameInput.value = "";
            }

            if (candidateEmailInput) {
                candidateEmailInput.value = "";
            }

            if (instructionAgreement) {
                instructionAgreement.checked = false;
            }

            showScreen(loginScreen);
        }
    );
}


// ============================================================
// START TEST BUTTON
// ============================================================

if (startTestBtn) {

    startTestBtn.addEventListener(
        "click",
        () => {

            if (
                instructionAgreement &&
                !instructionAgreement.checked
            ) {

                showMessage(
                    "Please confirm that you have read the instructions."
                );

                return;
            }


            if (!isExamLive()) {

                showMessage(
                    "The examination is not currently live."
                );

                return;
            }


            if (startTestModal) {
                startTestModal.classList.add("show");
            }
        }
    );
}


// ============================================================
// CANCEL START
// ============================================================

if (cancelStartBtn) {

    cancelStartBtn.addEventListener(
        "click",
        () => {

            startTestModal?.classList.remove(
                "show"
            );
        }
    );
}


// ============================================================
// CONFIRM START
// ============================================================

if (confirmStartBtn) {

    confirmStartBtn.addEventListener(
        "click",
        async () => {

            startTestModal?.classList.remove(
                "show"
            );

            await startExam();
        }
    );
}


// ============================================================
// LOAD QUESTIONS
// ============================================================

async function loadQuestions() {

    const questionsRef =
        collection(
            db,
            "questionBank"
        );


    const snapshot =
        await getDocs(
            questionsRef
        );


    let loadedQuestions =
        snapshot.docs.map(
            (item) => ({
                id: item.id,
                ...item.data()
            })
        );


    if (!loadedQuestions.length) {

        throw new Error(
            "No questions are available in the Question Bank."
        );
    }


    const displayCount =
        Math.min(
            Number(
                examSettings.questionsToDisplay
            ) || loadedQuestions.length,
            loadedQuestions.length
        );


    if (
        examSettings.randomQuestions !== false
    ) {

        loadedQuestions =
            shuffle(
                loadedQuestions
            );
    }


    loadedQuestions =
        loadedQuestions.slice(
            0,
            displayCount
        );


    return loadedQuestions;
}


// ============================================================
// NORMALIZE QUESTION
// ============================================================

function normalizeQuestion(question) {

    return {
        id:
            question.id ||
            question.questionId ||
            crypto.randomUUID(),

        question:
            question.question ||
            question.questionText ||
            "",

        options: [
            question.optionA ??
                question.options?.[0] ??
                "",

            question.optionB ??
                question.options?.[1] ??
                "",

            question.optionC ??
                question.options?.[2] ??
                "",

            question.optionD ??
                question.options?.[3] ??
                ""
        ],

        correctAnswer:
            question.correctAnswer ??
            question.answer ??
            "",

        marks:
            Number(
                question.marks ??
                examSettings.marksPerQuestion
            ),

        negativeMarks:
            Number(
                question.negativeMarks ??
                examSettings.negativeMarks
            ),

        chapter:
            question.chapter || "",

        topic:
            question.topic || "",

        difficulty:
            question.difficulty || ""
    };
}


// ============================================================
// START EXAM
// ============================================================

async function startExam() {

    if (examStarted) {
        return;
    }


    if (!isExamLive()) {

        showMessage(
            "Examination is not live."
        );

        return;
    }


    try {

        startTestBtn.disabled = true;

        questions =
            await loadQuestions();


        questions =
            questions.map(
                normalizeQuestion
            );


        if (!questions.length) {

            throw new Error(
                "No valid questions found."
            );
        }


        if (
            examSettings.randomOptions !== false
        ) {

            questions =
                questions.map(
                    (question) => {

                        const optionObjects =
                            question.options.map(
                                (text, index) => ({
                                    text,
                                    originalIndex:
                                        index
                                })
                            );


                        const shuffled =
                            shuffle(
                                optionObjects
                            );


                        return {
                            ...question,
                            displayOptions:
                                shuffled
                        };
                    }
                );

        } else {

            questions =
                questions.map(
                    (question) => ({
                        ...question,

                        displayOptions:
                            question.options.map(
                                (text, index) => ({
                                    text,
                                    originalIndex:
                                        index
                                })
                            )
                    })
                );
        }


        attemptId =
            `${candidate.email}_${Date.now()}`;


        const duration =
            Number(
                examSettings.durationMinutes
            ) || 60;


        remainingSeconds =
            duration * 60;


        currentQuestionIndex = 0;

        answers = {};

        violationCount = 0;

        securityPenalty = 0;

        examStarted = true;

        examSubmitted = false;

        questionStartTime =
            Date.now();


        await setDoc(
            doc(
                db,
                "attempts",
                attemptId
            ),
            {
                candidateName:
                    candidate.name,

                candidateEmail:
                    candidate.email,

                email:
                    candidate.email,

                status: "active",

                startedAt:
                    serverTimestamp(),

                questionCount:
                    questions.length,

                durationMinutes:
                    duration,

                violations: 0,

                securityPenalty: 0,

                currentQuestion: 1,

                updatedAt:
                    serverTimestamp()
            }
        );


        await updateCandidateStatus(
            "active",
            {
                testStartTime:
                    serverTimestamp()
            }
        );


        showScreen(examScreen);

        renderQuestion();

        startTimer();

        enableSecurityControls();


    } catch (error) {

        console.error(
            "Start exam error:",
            error
        );

        showMessage(
            error.message ||
            "Unable to start the examination."
        );

    } finally {

        startTestBtn.disabled = false;
    }
}


// ============================================================
// RENDER QUESTION
// ============================================================

function renderQuestion() {

    if (!questions.length) {
        return;
    }


    const question =
        questions[currentQuestionIndex];


    if (questionNumber) {

        questionNumber.textContent =
            currentQuestionIndex + 1;
    }


    const progress =
        document.querySelector(
            ".question-progress"
        );


    if (progress) {

        progress.textContent =
            `${currentQuestionIndex + 1} / ${questions.length}`;
    }


    if (questionText) {

        questionText.innerHTML =
            escapeHTML(
                question.question
            );
    }


    optionButtons.forEach(
        (button, index) => {

            const displayOption =
                question.displayOptions?.[index];


            const label =
                button.querySelector("span");


            if (label) {

                label.textContent =
                    String.fromCharCode(
                        65 + index
                    );
            }


            button.dataset.option =
                String(
                    displayOption?.originalIndex ??
                    index
                );


            const oldText =
                button.querySelector(
                    ".option-text"
                );


            if (oldText) {

                oldText.textContent =
                    displayOption?.text || "";

            } else {

                const labelText =
                    displayOption?.text || "";

                button.innerHTML =
                    `<span>${String.fromCharCode(65 + index)}</span> ${escapeHTML(labelText)}`;
            }


            const savedAnswer =
                answers[question.id];


            button.classList.toggle(
                "selected",
                String(
                    savedAnswer
                ) === String(
                    displayOption?.originalIndex
                )
            );
        }
    );


    if (previousBtn) {

        previousBtn.disabled =
            currentQuestionIndex === 0;
    }


    if (saveNextBtn) {

        saveNextBtn.textContent =
            currentQuestionIndex ===
            questions.length - 1
                ? "Submit Test"
                : "Save & Next →";
    }


    questionStartTime =
        Date.now();
}


// ============================================================
// OPTION SELECTION
// ============================================================

optionButtons.forEach(
    (button) => {

        button.addEventListener(
            "click",
            () => {

                if (
                    !examStarted ||
                    examSubmitted
                ) {
                    return;
                }


                const question =
                    questions[
                        currentQuestionIndex
                    ];


                const optionIndex =
                    Number(
                        button.dataset.option
                    );


                answers[
                    question.id
                ] = optionIndex;


                optionButtons.forEach(
                    (item) =>
                        item.classList.remove(
                            "selected"
                        )
                );


                button.classList.add(
                    "selected"
                );
            }
        );
    }
);


// ============================================================
// PREVIOUS
// ============================================================

if (previousBtn) {

    previousBtn.addEventListener(
        "click",
        () => {

            if (
                currentQuestionIndex <= 0
            ) {
                return;
            }


            currentQuestionIndex--;

            renderQuestion();
        }
    );
}


// ============================================================
// SAVE & NEXT
// ============================================================

if (saveNextBtn) {

    saveNextBtn.addEventListener(
        "click",
        async () => {

            if (
                !examStarted ||
                examSubmitted
            ) {
                return;
            }


            if (
                currentQuestionIndex <
                questions.length - 1
            ) {

                currentQuestionIndex++;

                renderQuestion();

                await updateAttemptProgress();

                return;
            }


            await submitExam(
                "manual"
            );
        }
    );
}


// ============================================================
// UPDATE LIVE ATTEMPT
// ============================================================

async function updateAttemptProgress() {

    if (!attemptId) {
        return;
    }


    try {

        await updateDoc(
            doc(
                db,
                "attempts",
                attemptId
            ),
            {
                currentQuestion:
                    currentQuestionIndex + 1,

                answered:
                    Object.keys(
                        answers
                    ).length,

                updatedAt:
                    serverTimestamp()
            }
        );

    } catch (error) {

        console.error(
            "Attempt update error:",
            error
        );
    }
}


// ============================================================
// TIMER
// ============================================================

function startTimer() {

    clearInterval(
        timerInterval
    );


    updateTimerUI();


    timerInterval =
        setInterval(
            async () => {

                if (
                    examSubmitted
                ) {

                    clearInterval(
                        timerInterval
                    );

                    return;
                }


                remainingSeconds--;

                updateTimerUI();


                if (
                    remainingSeconds <= 0
                ) {

                    clearInterval(
                        timerInterval
                    );


                    await submitExam(
                        "timer_auto_submit"
                    );
                }

            },
            1000
        );
}


// ============================================================
// TIMER UI
// ============================================================

function updateTimerUI() {

    if (!examTimer) {
        return;
    }


    examTimer.textContent =
        formatTime(
            remainingSeconds
        );
}


// ============================================================
// SECURITY MONITORING
// ============================================================

let securityHandlersEnabled = false;


function enableSecurityControls() {

    if (securityHandlersEnabled) {
        return;
    }

    securityHandlersEnabled = true;


    document.addEventListener(
        "visibilitychange",
        handleVisibilityChange
    );


    window.addEventListener(
        "blur",
        handleWindowBlur
    );


    document.addEventListener(
        "copy",
        handleCopy
    );


    document.addEventListener(
        "paste",
        handlePaste
    );


    document.addEventListener(
        "contextmenu",
        handleContextMenu
    );


    document.addEventListener(
        "keydown",
        handleKeyDown
    );


    window.addEventListener(
        "beforeunload",
        handleBeforeUnload
    );
}


// ============================================================
// TAB SWITCH
// ============================================================

async function handleVisibilityChange() {

    if (
        !examStarted ||
        examSubmitted
    ) {
        return;
    }


    if (
        document.visibilityState ===
        "hidden"
    ) {

        await registerViolation(
            "tab_switch"
        );
    }
}


// ============================================================
// WINDOW BLUR
// ============================================================

async function handleWindowBlur() {

    if (
        !examStarted ||
        examSubmitted
    ) {
        return;
    }


    await registerViolation(
        "window_blur"
    );
}


// ============================================================
// COPY
// ============================================================

async function handleCopy(event) {

    if (
        !examStarted ||
        examSubmitted
    ) {
        return;
    }


    if (
        examSettings?.disableCopy
    ) {

        event.preventDefault();

        await registerViolation(
            "copy_attempt"
        );
    }
}


// ============================================================
// PASTE
// ============================================================

async function handlePaste(event) {

    if (
        !examStarted ||
        examSubmitted
    ) {
        return;
    }


    if (
        examSettings?.disablePaste
    ) {

        event.preventDefault();

        await registerViolation(
            "paste_attempt"
        );
    }
}


// ============================================================
// RIGHT CLICK
// ============================================================

async function handleContextMenu(event) {

    if (
        !examStarted ||
        examSubmitted
    ) {
        return;
    }


    event.preventDefault();

    await registerViolation(
        "right_click_attempt"
    );
}


// ============================================================
// KEYBOARD SECURITY
// ============================================================

async function handleKeyDown(event) {

    if (
        !examStarted ||
        examSubmitted
    ) {
        return;
    }


    const key =
        String(
            event.key || ""
        ).toLowerCase();


    const blockedFunctionKey =
        examSettings?.disableFunctionKeys &&
        /^f([1-9]|1[0-2])$/
            .test(key);


    const blockedShortcut =
        examSettings?.disableFunctionKeys &&
        (
            event.ctrlKey ||
            event.metaKey
        ) &&
        [
            "c",
            "v",
            "x",
            "u",
            "s",
            "p"
        ].includes(key);


    if (
        blockedFunctionKey ||
        blockedShortcut
    ) {

        event.preventDefault();

        await registerViolation(
            "keyboard_shortcut_attempt"
        );
    }
}


// ============================================================
// REFRESH PROTECTION
// ============================================================

async function handleBeforeUnload(event) {

    if (
        !examStarted ||
        examSubmitted
    ) {
        return;
    }


    if (
        examSettings?.disableRefresh
    ) {

        event.preventDefault();

        event.returnValue = "";
    }
}


// ============================================================
// REGISTER VIOLATION
// ============================================================

async function registerViolation(type) {

    if (
        !examStarted ||
        examSubmitted
    ) {
        return;
    }


    violationCount++;


    const penalty =
        Number(
            examSettings?.tabSwitchPenalty
        ) || 0;


    securityPenalty +=
        penalty;


    try {

        await addDoc(
            collection(
                db,
                "violations"
            ),
            {
                candidateName:
                    candidate.name,

                candidateEmail:
                    candidate.email,

                email:
                    candidate.email,

                attemptId:

                    attemptId,

                violationType:
                    type,

                timestamp:
                    serverTimestamp(),

                questionNumber:
                    currentQuestionIndex + 1,

                penaltyApplied:
                    penalty
            }
        );


        if (attemptId) {

            await updateDoc(
                doc(
                    db,
                    "attempts",
                    attemptId
                ),
                {
                    violations:
                        violationCount,

                    securityPenalty:
                        securityPenalty,

                    updatedAt:
                        serverTimestamp()
                }
            );
        }


        const maxViolations =
            Number(
                examSettings?.maxTabSwitches
            ) || 0;


        if (
            maxViolations > 0 &&
            violationCount >=
                maxViolations
        ) {

            await submitExam(
                "security_auto_submit"
            );
        }


    } catch (error) {

        console.error(
            "Violation logging error:",
            error
        );
    }
}


// ============================================================
// CALCULATE RESULT
// ============================================================

function calculateResult() {

    let correct = 0;
    let wrong = 0;
    let attempted = 0;
    let unattempted = 0;

    let rawMarks = 0;
    let negativeMarks = 0;


    const questionResults =
        questions.map(
            (question, index) => {

                const candidateAnswer =
                    answers[
                        question.id
                    ];


                const hasAnswer =
                    candidateAnswer !==
                    undefined &&
                    candidateAnswer !==
                    null;


                if (!hasAnswer) {

                    unattempted++;

                    return {
                        questionId:
                            question.id,

                        questionNumber:
                            index + 1,

                        question:
                            question.question,

                        candidateAnswer:
                            null,

                        correctAnswer:
                            question.correctAnswer,

                        marks:
                            0,

                        negativeMarks:
                            0,

                        finalMarks:
                            0,

                        status:
                            "unattempted"
                    };
                }


                attempted++;


                const correctAnswer =
                    String(
                        question.correctAnswer
                    );


                const candidateAnswerString =
                    String(
                        candidateAnswer
                    );


                const isCorrect =
                    candidateAnswerString ===
                    correctAnswer;


                if (isCorrect) {

                    correct++;

                    rawMarks +=
                        question.marks;

                    return {
                        questionId:
                            question.id,

                        questionNumber:
                            index + 1,

                        question:
                            question.question,

                        candidateAnswer:
                            candidateAnswer,

                        correctAnswer:
                            question.correctAnswer,

                        marks:
                            question.marks,

                        negativeMarks:
                            0,

                        finalMarks:
                            question.marks,

                        status:
                            "correct"
                    };
                }


                wrong++;

                negativeMarks +=
                    question.negativeMarks;


                return {
                    questionId:
                        question.id,

                    questionNumber:
                        index + 1,

                    question:
                        question.question,

                    candidateAnswer:
                        candidateAnswer,

                    correctAnswer:
                        question.correctAnswer,

                    marks:
                        0,

                    negativeMarks:
                        question.negativeMarks,

                    finalMarks:
                        -question.negativeMarks,

                    status:
                        "wrong"
                };
            }
        );


    const finalMarks =
        rawMarks -
        negativeMarks -
        securityPenalty;


    const maxMarks =
        questions.reduce(
            (sum, question) =>
                sum + question.marks,
            0
        );


    const percentage =
        maxMarks > 0
            ? (
                finalMarks /
                maxMarks
            ) * 100
            : 0;


    return {

        totalQuestions:
            questions.length,

        attempted,

        correct,

        wrong,

        unattempted,

        rawMarks,

        negativeMarks,

        securityPenalty,

        finalMarks,

        maxMarks,

        percentage:
            Math.max(
                0,
                Number(
                    percentage.toFixed(2)
                )
            ),

        questionResults
    };
}


// ============================================================
// SUBMIT EXAM
// ============================================================

async function submitExam(
    submissionType = "manual"
) {

    if (examSubmitted) {
        return;
    }


    examSubmitted = true;

    clearInterval(
        timerInterval
    );


    try {

        const result =
            calculateResult();


        const resultData = {

            attemptId,

            candidateName:
                candidate.name,

            candidateEmail:
                candidate.email,

            email:
                candidate.email,

            examTitle:
                examSettings?.examTitle ||
                "Online Examination",

            ...result,

            submissionType,

            submittedAt:
                serverTimestamp(),

            updatedAt:
                serverTimestamp()
        };


        await setDoc(
            doc(
                db,
                "results",
                attemptId
            ),
            resultData
        );


        if (attemptId) {

            await updateDoc(
                doc(
                    db,
                    "attempts",
                    attemptId
                ),
                {
                    status:
                        submissionType ===
                        "security_auto_submit"
                            ? "auto_submitted"
                            : "submitted",

                    submissionType,

                    submittedAt:
                        serverTimestamp(),

                    finalMarks:
                        result.finalMarks,

                    updatedAt:
                        serverTimestamp()
                }
            );
        }


        await updateCandidateStatus(
            submissionType ===
                "security_auto_submit"
                ? "auto_submitted"
                : "completed",
            {
                submissionTime:
                    serverTimestamp(),

                score:
                    result.finalMarks,

                violations:
                    violationCount
            }
        );


        disableExamControls();


        showMessage(
            "Examination submitted successfully."
        );


        /*
         * IMPORTANT:
         * Current index.html does not yet contain
         * Result / Feedback screens.
         *
         * Those will be added in the next step
         * without changing the existing design.
         */

        window.examResult =
            resultData;


    } catch (error) {

        console.error(
            "Submission error:",
            error
        );

        examSubmitted = false;

        showMessage(
            "Unable to submit examination. Please check your internet connection and try again."
        );
    }
}


// ============================================================
// UPDATE CANDIDATE
// ============================================================

async function updateCandidateStatus(
    status,
    extra = {}
) {

    if (!candidate.email) {
        return;
    }


    await setDoc(
        doc(
            db,
            "candidates",
            candidate.email
        ),
        {
            name:
                candidate.name,

            email:
                candidate.email,

            status,

            ...extra,

            updatedAt:
                serverTimestamp()
        },
        {
            merge: true
        }
    );
}


// ============================================================
// DISABLE EXAM CONTROLS
// ============================================================

function disableExamControls() {

    optionButtons.forEach(
        button => {
            button.disabled = true;
        }
    );


    if (previousBtn) {
        previousBtn.disabled = true;
    }


    if (saveNextBtn) {
        saveNextBtn.disabled = true;
    }
}


// ============================================================
// INITIALIZE
// ============================================================

listenExamSettings();

showScreen(
    loginScreen
);


console.log(
    "Student Examination Portal initialized."
);
