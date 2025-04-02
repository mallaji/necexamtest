document.addEventListener('DOMContentLoaded', () => {
    let questions = [];
    let currentPage = 0;
    const questionsPerPage = 5;
    let userAnswers = {};
    let timeLeft = 180 * 60; // 3 hours
    let timerInterval;

    // Load available sets
    fetch('questions/sets.json')
        .then(res => res.json())
        .then(sets => {
            const setOptions = document.getElementById('set-options');
            sets.forEach(set => {
                setOptions.innerHTML += `
                    <button class="start-btn" onclick="selectSet('${set.id}')">${set.name}</button>
                `;
            });
        })
        .catch(err => {
            console.error('Failed to load sets.json:', err);
            alert('Failed to load exam sets. Please refresh the page.');
        });

    // Select exam set
    window.selectSet = function(setId) {
        document.getElementById('set-selection-screen').style.display = 'none';
        document.getElementById('welcome-screen').style.display = 'block';
        
        
        fetch('questions/sets.json')
            .then(res => res.json())
            .then(sets => {
                const selectedSet = sets.find(s => s.id === setId);
                if (selectedSet) {
                    fetch(`questions/${selectedSet.file}`)
                        .then(res => res.json())
                        .then(data => {
                            questions = data;
                            document.getElementById('totalQuestions').textContent = questions.length;
                            document.getElementById('total-questions-display').textContent = questions.length;
                        })
                        .catch(err => {
                            console.error(`Failed to load ${selectedSet.file}:`, err);
                            alert('Failed to load questions. Please try again.');
                            restartExam();
                        });
                }
            });
    };

    window.startExam = function() {
        document.getElementById('welcome-screen').style.display = 'none';
        document.getElementById('container').style.display = 'block';
        startTimer();
        updateAttemptedCount();
        updateProgressBar();
        renderQuestions();
    };

    function renderQuestions() {
        const container = document.getElementById('container');
        container.innerHTML = '';
        const start = currentPage * questionsPerPage;
        const end = start + questionsPerPage;
        const pageQuestions = questions.slice(start, end);
        pageQuestions.forEach((q) => {
            container.innerHTML += `
              <div class="question-page">
                <div class="question">
                  <h3>Question ${q.id} <small>(${q.section === 'A' ? '1 Mark' : '2 Marks'})</small></h3>
                  <p>${q.text}</p>
                  ${q.image ? `<img src="images/${q.image}" alt="Question ${q.id} image" class="question-image">` : ''}
                  ${q.code ? `<pre><code>${q.code}</code></pre>` : ''}
                  <div class="options">
                    ${q.options.map((opt, i) => `
                      <label class="${userAnswers[q.id] === i ? 'selected' : ''}">
                        <input type="radio" name="q${q.id}" value="${i}"
                          ${userAnswers[q.id] === i ? 'checked' : ''}
                          onchange="saveAnswer(${q.id}, ${i})">
                        <span>${String.fromCharCode(65 + i)}. ${opt}</span>
                      </label>
                    `).join('')}
                  </div>
                </div>
              </div>`;
        });

        container.innerHTML += `
            <div class="navigation">
              <button ${currentPage === 0 ? 'disabled' : ''} onclick="changePage(-1)">
                <i class="fas fa-arrow-left"></i> Previous
              </button>
              <div class="page-indicator">
                Page ${currentPage + 1} of ${Math.ceil(questions.length / questionsPerPage)}
              </div>
              <button ${currentPage >= Math.ceil(questions.length / questionsPerPage) - 1 ? 'disabled' : ''} onclick="changePage(1)">
                Next <i class="fas fa-arrow-right"></i>
              </button>
            </div>`;
    }

    window.changePage = function(dir) {
        currentPage += dir;
        renderQuestions();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    window.saveAnswer = function(qId, answer) {
        userAnswers[qId] = answer;
        updateAttemptedCount();
        updateCurrentScore();
        updateProgressBar();
        checkAllQuestionsAttempted();
    };

    function updateAttemptedCount() {
        document.getElementById('attempted').textContent = Object.keys(userAnswers).length;
    }

    function updateCurrentScore() {
        let score = 0;
        Object.keys(userAnswers).forEach(qId => {
            const q = questions.find(q => q.id == qId);
            if (q && userAnswers[qId] === q.answer) {
                score += q.section === 'A' ? 1 : 2;
            }
        });
        document.getElementById('current-score').textContent = score;
    }

    function updateProgressBar() {
        const progress = (Object.keys(userAnswers).length / questions.length) * 100;
        document.getElementById('progressBar').style.width = `${progress}%`;
    }

    function checkAllQuestionsAttempted() {
        const submitBtn = document.getElementById('submit-btn');
        const fabSubmit = document.getElementById('fabSubmit');
        const allAnswered = Object.keys(userAnswers).length === questions.length;
        submitBtn.style.display = allAnswered ? 'block' : 'none';
        fabSubmit.style.display = allAnswered ? 'flex' : 'none';
    }

    function startTimer() {
        timerInterval = setInterval(() => {
            timeLeft--;
            if (timeLeft <= 0) {
                clearInterval(timerInterval);
                calculateScore();
                alert('Time is up! Your exam has been submitted.');
            }
            updateTimerDisplay();
        }, 1000);
    }

    function updateTimerDisplay() {
        const h = String(Math.floor(timeLeft / 3600)).padStart(2, '0');
        const m = String(Math.floor((timeLeft % 3600) / 60)).padStart(2, '0');
        const s = String(timeLeft % 60).padStart(2, '0');
        document.getElementById('timer').textContent = `${h}:${m}:${s}`;
        if (timeLeft <= 1800) document.getElementById('timer').style.color = 'var(--danger-color)';
    }

    window.calculateScore = function() {
        clearInterval(timerInterval);
        let sectionAScore = 0, sectionBScore = 0, correctAnswers = 0;
        Object.keys(userAnswers).forEach(qId => {
            const q = questions.find(q => q.id == qId);
            if (q && userAnswers[qId] === q.answer) {
                if (q.section === 'A') sectionAScore += 1;
                else sectionBScore += 2;
                correctAnswers++;
            }
        });
        const total = sectionAScore + sectionBScore;
        document.getElementById('final-score').textContent = total;
        document.getElementById('section-scores').innerHTML = `
            <p><span>Section A:</span> ${sectionAScore}/60</p>
            <p><span>Section B:</span> ${sectionBScore}/40</p>
            <p><span>Correct Answers:</span> ${correctAnswers}/${questions.length}</p>
            <p><span>Time Taken:</span> ${formatTimeTaken(180 * 60 - timeLeft)}</p>
        `;
        document.getElementById('resultModal').style.display = 'flex';
    };

    function formatTimeTaken(sec) {
        const h = String(Math.floor(sec / 3600)).padStart(2, '0');
        const m = String(Math.floor((sec % 3600) / 60)).padStart(2, '0');
        const s = String(sec % 60).padStart(2, '0');
        return `${h}:${m}:${s}`;
    }

    window.restartExam = function() {
        location.reload();
    };
});