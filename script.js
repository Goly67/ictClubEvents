// Global variables
let currentSession = 'morning';
let currentEvent = null;
let students = [];
let events = [];
let attendanceRecords = [];

// DOM elements
const sidebar = document.getElementById('sidebar');
const sidebarToggle = document.getElementById('sidebarToggle');
const navItems = document.querySelectorAll('.nav-item');
const sections = document.querySelectorAll('.section');
const pageTitle = document.getElementById('pageTitle');

// Initialize Firebase authentication anonymously
firebase.auth().signInAnonymously()
    .then(() => {
        console.log("Signed in anonymously");
    })
    .catch((error) => {
        console.error("Auth error:", error);
    });

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    setupEventListeners();
    startClock();
    initializeApp();
});

// Initialize app
function initializeApp() {
    loadStudents();
    loadEvents();
    loadAttendanceHistory();
    updateDashboard();
}

// Setup event listeners
function setupEventListeners() {
    // Sidebar toggle for mobile
    if (sidebarToggle) {
        sidebarToggle.addEventListener('click', () => {
            sidebar.classList.toggle('active');
        });
    }

    // Navigation
    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const targetSection = item.getAttribute('data-section');
            showSection(targetSection);
            
            // Update active nav item
            navItems.forEach(nav => nav.classList.remove('active'));
            item.classList.add('active');
            
            // Update page title
            const sectionTitles = {
                'dashboard': 'Dashboard',
                'events': 'Events',
                'add-student': 'Add Students',
                'attendance-list': 'Attendance List',
                'user-management': 'User Management'
            };
            pageTitle.textContent = sectionTitles[targetSection] || 'Dashboard';
            
            // Close sidebar on mobile
            if (window.innerWidth <= 1024) {
                sidebar.classList.remove('active');
            }
        });
    });

    // Create event form
    document.getElementById('createEventForm').addEventListener('submit', createEvent);

    // Add student form
    document.getElementById('addStudentForm').addEventListener('submit', addStudent);

    // Student name input for suggestions
    document.getElementById('studentName').addEventListener('input', showStudentSuggestions);

    // Click outside to close suggestions
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.search-input-container')) {
            document.getElementById('studentSuggestions').classList.remove('active');
        }
    });
}

// Clock function
function startClock() {
    function updateTime() {
        const now = new Date();
        const timeString = now.toLocaleString('en-US', {
            weekday: 'short',
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
        document.getElementById('timeDisplay').textContent = timeString;
    }
    
    updateTime();
    setInterval(updateTime, 1000);
}

// Show specific section
function showSection(sectionId) {
    sections.forEach(section => {
        section.classList.remove('active');
    });
    document.getElementById(sectionId).classList.add('active');
}

// Create event
function createEvent(e) {
    e.preventDefault();
    
    const title = document.getElementById('newEventTitle').value.trim();
    const date = document.getElementById('newEventDate').value;
    const description = document.getElementById('eventDescription').value.trim();

    if (!title || !date) {
        showMessage('Please fill in event title and date.', 'error');
        return;
    }

    const event = {
        id: Date.now().toString(),
        title: title,
        date: date,
        description: description,
        createdAt: new Date().toISOString(),
        status: getEventStatus(date)
    };

    // Save to Firebase
    database.ref('events/' + event.id).set(event)
        .then(() => {
            showMessage('Event created successfully!', 'success');
            document.getElementById('createEventForm').reset();
            loadEvents();
        })
        .catch((error) => {
            showMessage('Error creating event: ' + error.message, 'error');
        });
}

// Get event status
function getEventStatus(eventDate) {
    const today = new Date().toDateString();
    const event = new Date(eventDate).toDateString();
    
    if (event === today) return 'active';
    if (new Date(eventDate) > new Date()) return 'upcoming';
    return 'past';
}

// Load events
function loadEvents() {
    database.ref('events').on('value', (snapshot) => {
        events = [];
        const data = snapshot.val();
        
        if (data) {
            Object.keys(data).forEach(key => {
                const event = { ...data[key], id: key };
                event.status = getEventStatus(event.date);
                events.push(event);
            });
        }
        
        displayEvents();
        updateDashboard();
    });
}

// Display events
function displayEvents() {
    const eventsTableBody = document.getElementById('eventsTableBody');
    
    if (events.length === 0) {
        eventsTableBody.innerHTML = '<tr><td colspan="5" class="no-data">No events found.</td></tr>';
        return;
    }

    // Sort events by date (newest first)
    events.sort((a, b) => new Date(b.date) - new Date(a.date));

    eventsTableBody.innerHTML = events.map(event => `
        <tr>
            <td><strong>${event.title}</strong></td>
            <td>${new Date(event.date).toLocaleDateString()}</td>
            <td><span class="event-status ${event.status}">${event.status.toUpperCase()}</span></td>
            <td>
                <span id="attendees-${event.id}">Loading...</span>
            </td>
            <td>
                ${event.status === 'active' ? 
                    `<button class="btn btn-success" onclick="openEventAttendance('${event.id}')">
                        <i class="fas fa-users"></i> Manage
                    </button>` : 
                    `<button class="btn btn-secondary" onclick="viewEventDetails('${event.id}')">
                        <i class="fas fa-eye"></i> View
                    </button>`
                }
            </td>
        </tr>
    `).join('');

    // Load attendee counts
    events.forEach(event => {
        loadAttendeeCount(event.id);
    });
}

// Load attendee count for an event
function loadAttendeeCount(eventId) {
    database.ref('attendance').orderByChild('eventId').equalTo(eventId).once('value', (snapshot) => {
        const count = snapshot.numChildren();
        const attendeesElement = document.getElementById(`attendees-${eventId}`);
        if (attendeesElement) {
            attendeesElement.textContent = count;
        }
    });
}

// Update dashboard
function updateDashboard() {
    const today = new Date().toDateString();
    const todayEvents = events.filter(event => 
        new Date(event.date).toDateString() === today
    );
    
    const recentEvents = events
        .filter(event => event.status !== 'upcoming')
        .slice(0, 5);

    // Display today's events
    const todayEventsGrid = document.getElementById('todayEventsGrid');
    if (todayEvents.length === 0) {
        todayEventsGrid.innerHTML = '<p class="no-data">No events scheduled for today.</p>';
    } else {
        todayEventsGrid.innerHTML = todayEvents.map(event => `
            <div class="event-card ${event.status}" onclick="openEventAttendance('${event.id}')">
                <h4>${event.title}</h4>
                <p><i class="fas fa-calendar"></i> ${new Date(event.date).toLocaleDateString()}</p>
                <p><i class="fas fa-info-circle"></i> ${event.description || 'No description'}</p>
                <span class="event-status ${event.status}">${event.status.toUpperCase()}</span>
            </div>
        `).join('');
    }

    // Display recent events
    const recentEventsList = document.getElementById('recentEventsList');
    if (recentEvents.length === 0) {
        recentEventsList.innerHTML = '<p class="no-data">No recent events found.</p>';
    } else {
        recentEventsList.innerHTML = recentEvents.map(event => `
            <div class="event-item">
                <div class="event-item-info">
                    <h5>${event.title}</h5>
                    <p>${new Date(event.date).toLocaleDateString()} • ${event.status}</p>
                </div>
                <button class="btn btn-secondary" onclick="viewEventDetails('${event.id}')">
                    <i class="fas fa-eye"></i>
                </button>
            </div>
        `).join('');
    }
}

// Open event attendance
function openEventAttendance(eventId) {
    const event = events.find(e => e.id === eventId);
    if (!event) return;

    currentEvent = event;
    
    // Update event header
    document.getElementById('currentEventTitle').textContent = event.title;
    document.getElementById('currentEventDate').textContent = new Date(event.date).toLocaleDateString();
    
    // Show event attendance section
    showSection('event-attendance');
    
    // Update page title
    pageTitle.textContent = `${event.title} - Attendance`;
    
    // Load attendance table
    loadAttendanceTable();
}

// Go back to dashboard
function goBackToDashboard() {
    showSection('dashboard');
    pageTitle.textContent = 'Dashboard';
    
    // Update active nav item
    navItems.forEach(nav => nav.classList.remove('active'));
    document.querySelector('[data-section="dashboard"]').classList.add('active');
}

// View event details
function viewEventDetails(eventId) {
    // For now, just open the event attendance
    openEventAttendance(eventId);
}

// Set session
function setSession(session) {
    currentSession = session;
    
    // Update session buttons
    document.querySelectorAll('.session-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelector(`[data-session="${session}"]`).classList.add('active');
    
    // Update session title
    document.getElementById('currentSessionTitle').textContent = 
        session.charAt(0).toUpperCase() + session.slice(1);
    
    loadAttendanceTable();
}

// Add student
function addStudent(e) {
    e.preventDefault();
    
    const fullName = document.getElementById('fullName').value.trim();
    const strand = document.getElementById('strand').value.trim();
    const grade = document.getElementById('grade').value.trim();

    if (!fullName || !strand || !grade) {
        showMessage('Please fill in all fields.', 'error');
        return;
    }

    const student = {
        id: Date.now().toString(),
        fullName: fullName,
        strand: strand,
        grade: grade,
        dateAdded: new Date().toISOString()
    };

    // Save to Firebase
    database.ref('students/' + student.id).set(student)
        .then(() => {
            showMessage('Student added successfully!', 'success');
            document.getElementById('addStudentForm').reset();
            loadStudents();
        })
        .catch((error) => {
            showMessage('Error adding student: ' + error.message, 'error');
        });
}

// Load students from Firebase
function loadStudents() {
    database.ref('students').on('value', (snapshot) => {
        students = [];
        const data = snapshot.val();
        
        if (data) {
            Object.keys(data).forEach(key => {
                students.push({ ...data[key], id: key });
            });
        }
        
        displayStudents();
    });
}

// Display students
function displayStudents() {
    const studentsGrid = document.getElementById('studentsGrid');
    
    if (students.length === 0) {
        studentsGrid.innerHTML = '<p class="no-data">No students registered yet.</p>';
        return;
    }

    studentsGrid.innerHTML = students.map(student => `
        <div class="student-card">
            <h4><i class="fas fa-user"></i> ${student.fullName}</h4>
            <p><i class="fas fa-book"></i> <strong>Strand/Course:</strong> ${student.strand}</p>
            <p><i class="fas fa-graduation-cap"></i> <strong>Grade/Year:</strong> ${student.grade}</p>
        </div>
    `).join('');
}

// Show student suggestions
function showStudentSuggestions() {
    const input = document.getElementById('studentName');
    const suggestions = document.getElementById('studentSuggestions');
    const query = input.value.toLowerCase().trim();

    if (query.length < 1) {
        suggestions.classList.remove('active');
        return;
    }

    const filteredStudents = students.filter(student => 
        student.fullName.toLowerCase().includes(query)
    );

    if (filteredStudents.length === 0) {
        suggestions.classList.remove('active');
        return;
    }

    suggestions.innerHTML = filteredStudents.map(student => `
        <div class="suggestion-item" onclick="selectStudent('${student.fullName}')">
            <strong>${student.fullName}</strong><br>
            <small>${student.strand} - ${student.grade}</small>
        </div>
    `).join('');

    suggestions.classList.add('active');
}

// Select student from suggestions
function selectStudent(fullName) {
    document.getElementById('studentName').value = fullName;
    document.getElementById('studentSuggestions').classList.remove('active');
}

// Login student
function loginStudent() {
    const studentName = document.getElementById('studentName').value.trim();
    
    if (!studentName) {
        showMessage('Please enter a student name.', 'error');
        return;
    }

    if (!currentEvent) {
        showMessage('Please select an event first.', 'error');
        return;
    }

    // Find student in database
    const student = students.find(s => s.fullName.toLowerCase() === studentName.toLowerCase());
    
    if (!student) {
        showMessage('Student not found in database.', 'error');
        return;
    }

    // Check if already logged in for this session
    const existingRecord = attendanceRecords.find(record => 
        record.studentId === student.id && 
        record.eventId === currentEvent.id && 
        record.session === currentSession
    );

    if (existingRecord && existingRecord.loginTime) {
        showMessage('Student already logged in for this session.', 'error');
        return;
    }

    // Store current scroll position
    const currentScrollY = window.scrollY;

    const attendanceRecord = {
        id: Date.now().toString(),
        studentId: student.id,
        eventId: currentEvent.id,
        eventTitle: currentEvent.title,
        eventDate: currentEvent.date,
        session: currentSession,
        studentName: student.fullName,
        strand: student.strand,
        grade: student.grade,
        loginTime: new Date().toLocaleTimeString(),
        logoutTime: null,
        date: new Date().toLocaleDateString()
    };

    // Save to Firebase
    database.ref('attendance/' + attendanceRecord.id).set(attendanceRecord)
        .then(() => {
            showMessage('Student logged in successfully!', 'success');
            document.getElementById('studentName').value = '';
            document.getElementById('studentSuggestions').classList.remove('active');
            
            // Maintain scroll position after table reload
            setTimeout(() => {
                window.scrollTo(0, currentScrollY);
            }, 100);
        })
        .catch((error) => {
            showMessage('Error logging in student: ' + error.message, 'error');
        });
}

// Logout student
function logoutStudent(recordId) {
    const currentScrollY = window.scrollY;
    const logoutTime = new Date().toLocaleTimeString();
    
    database.ref('attendance/' + recordId).update({
        logoutTime: logoutTime
    })
    .then(() => {
        showMessage('Student logged out successfully!', 'success');
        
        // Maintain scroll position after table reload
        setTimeout(() => {
            window.scrollTo(0, currentScrollY);
        }, 100);
    })
    .catch((error) => {
        showMessage('Error logging out student: ' + error.message, 'error');
    });
}

// Load attendance table
function loadAttendanceTable() {
    if (!currentEvent) return;

    database.ref('attendance').orderByChild('eventId').equalTo(currentEvent.id).on('value', (snapshot) => {
        attendanceRecords = [];
        const data = snapshot.val();
        
        if (data) {
            Object.keys(data).forEach(key => {
                attendanceRecords.push({ ...data[key], id: key });
            });
        }
        
        displayAttendanceTable();
    });
}

// Display attendance table with pagination
function displayAttendanceTable() {
    const tableBody = document.getElementById('attendanceTableBody');
    const currentScrollY = window.scrollY;
    
    // Filter records by current session
    const sessionRecords = attendanceRecords.filter(record => record.session === currentSession);
    
    if (sessionRecords.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="6" class="no-data">No attendance records for this session.</td></tr>';
        return;
    }

    const limit = 10;
    const showAll = sessionRecords.length <= limit;
    const recordsToShow = showAll ? sessionRecords : sessionRecords.slice(0, limit);
    const hiddenRecords = showAll ? [] : sessionRecords.slice(limit);

    let tableHTML = recordsToShow.map(record => `
        <tr class="attendance-row" style="transition: background-color 0.2s ease;">
            <td><strong>${record.studentName}</strong></td>
            <td>${record.strand}</td>
            <td>${record.grade}</td>
            <td>${record.loginTime}</td>
            <td>${record.logoutTime || '-'}</td>
            <td>
                ${!record.logoutTime ? 
                    `<button class="btn btn-danger" onclick="logoutStudent('${record.id}')">
                        <i class="fas fa-sign-out-alt"></i> Logout
                    </button>` : 
                    '<span style="color: #6b7280; font-size: 12px;">Completed</span>'
                }
            </td>
        </tr>
    `).join('');

    // Add hidden rows
    if (!showAll) {
        tableHTML += hiddenRecords.map(record => `
            <tr class="attendance-row hidden" data-hidden="true" style="transition: background-color 0.2s ease;">
                <td><strong>${record.studentName}</strong></td>
                <td>${record.strand}</td>
                <td>${record.grade}</td>
                <td>${record.loginTime}</td>
                <td>${record.logoutTime || '-'}</td>
                <td>
                    ${!record.logoutTime ? 
                        `<button class="btn btn-danger" onclick="logoutStudent('${record.id}')">
                            <i class="fas fa-sign-out-alt"></i> Logout
                        </button>` : 
                        '<span style="color: #6b7280; font-size: 12px;">Completed</span>'
                }
            </td>
        </tr>
    `).join('');

    // Add see more button
    tableHTML += `
            <tr>
                <td colspan="6" class="see-more-container">
                    <button class="btn see-more-btn" onclick="toggleAttendanceRows('event')">
                        <i class="fas fa-chevron-down"></i>
                        See More (${hiddenRecords.length} more records)
                    </button>
                </td>
            </tr>
        `;
    }

    tableBody.innerHTML = tableHTML;
    
    // Restore scroll position
    setTimeout(() => {
        window.scrollTo(0, currentScrollY);
    }, 10);
}

// Toggle attendance rows visibility
function toggleAttendanceRows(type) {
    if (type === 'event') {
        const hiddenRows = document.querySelectorAll('#attendanceTableBody .attendance-row[data-hidden="true"]');
        const button = document.querySelector('#attendanceTableBody .see-more-btn');
        const isHidden = hiddenRows[0]?.classList.contains('hidden');

        hiddenRows.forEach(row => {
            if (isHidden) {
                row.classList.remove('hidden');
            } else {
                row.classList.add('hidden');
            }
        });

        if (button) {
            if (isHidden) {
                button.innerHTML = '<i class="fas fa-chevron-up"></i> See Less';
            } else {
                button.innerHTML = `<i class="fas fa-chevron-down"></i> See More (${hiddenRows.length} more records)`;
            }
        }
    }
}

// Toggle history rows visibility
function toggleHistoryRows(eventId) {
    const hiddenRows = document.querySelectorAll(`[data-event-id="${eventId}"][data-hidden="true"]`);
    const button = document.querySelector(`[data-event-id="${eventId}"].see-more-btn`);
    const isHidden = hiddenRows[0]?.classList.contains('hidden');

    hiddenRows.forEach(row => {
        if (isHidden) {
            row.classList.remove('hidden');
        } else {
            row.classList.add('hidden');
        }
    });

    if (button) {
        if (isHidden) {
            button.innerHTML = '<i class="fas fa-chevron-up"></i> See Less';
        } else {
            button.innerHTML = `<i class="fas fa-chevron-down"></i> See More (${hiddenRows.length} more records)`;
        }
    }
}

// Load attendance history with pagination
function loadAttendanceHistory() {
    database.ref('attendance').on('value', (snapshot) => {
        const historyContainer = document.getElementById('attendanceHistory');
        const data = snapshot.val();
        
        if (!data) {
            historyContainer.innerHTML = '<p class="no-data">No attendance records found.</p>';
            return;
        }

        const records = Object.keys(data).map(key => ({ ...data[key], id: key }));
        
        // Group by event
        const groupedRecords = records.reduce((acc, record) => {
            const key = record.eventId;
            if (!acc[key]) {
                acc[key] = [];
            }
            acc[key].push(record);
            return acc;
        }, {});

        historyContainer.innerHTML = Object.keys(groupedRecords).map(eventId => {
            const eventRecords = groupedRecords[eventId];
            const firstRecord = eventRecords[0];
            
            const limit = 10;
            const showAll = eventRecords.length <= limit;
            const recordsToShow = showAll ? eventRecords : eventRecords.slice(0, limit);
            const hiddenRecords = showAll ? [] : eventRecords.slice(limit);
            
            let recordsHTML = recordsToShow.map(record => `
                <tr data-event-id="${eventId}">
                    <td><strong>${record.studentName}</strong></td>
                    <td>${record.strand}</td>
                    <td><span style="padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: 500; ${record.session === 'morning' ? 'background-color: #fef3c7; color: #92400e;' : 'background-color: #dbeafe; color: #1e40af;'}">${record.session}</span></td>
                    <td>${record.loginTime}</td>
                    <td>${record.logoutTime || '-'}</td>
                </tr>
            `).join('');

            // Add hidden records
            if (!showAll) {
                recordsHTML += hiddenRecords.map(record => `
                    <tr data-event-id="${eventId}" data-hidden="true" class="hidden">
                        <td><strong>${record.studentName}</strong></td>
                        <td>${record.strand}</td>
                        <td><span style="padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: 500; ${record.session === 'morning' ? 'background-color: #fef3c7; color: #92400e;' : 'background-color: #dbeafe; color: #1e40af;'}">${record.session}</span></td>
                        <td>${record.loginTime}</td>
                        <td>${record.logoutTime || '-'}</td>
                    </tr>
                `).join('');
            }

            return `
                <div style="margin-bottom: 24px; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden;">
                    <div style="padding: 16px; background-color: #f9fafb; border-bottom: 1px solid #e5e7eb;">
                        <h4 style="margin: 0; color: #1a1a1a;">
                            <i class="fas fa-calendar"></i> 
                            ${firstRecord.eventTitle || 'Event'} - ${new Date(firstRecord.eventDate || firstRecord.date).toLocaleDateString()}
                        </h4>
                    </div>
                    <div style="padding: 16px;">
                        <div class="table-container">
                            <table class="attendance-table">
                                <thead>
                                    <tr>
                                        <th>Student Name</th>
                                        <th>Strand/Course</th>
                                        <th>Session</th>
                                        <th>Login Time</th>
                                        <th>Logout Time</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${recordsHTML}
                                    ${!showAll ? `
                                        <tr>
                                            <td colspan="5" class="see-more-container">
                                                <button class="btn see-more-btn" data-event-id="${eventId}" onclick="toggleHistoryRows('${eventId}')">
                                                    <i class="fas fa-chevron-down"></i>
                                                    See More (${hiddenRecords.length} more records)
                                                </button>
                                            </td>
                                        </tr>
                                    ` : ''}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    });
}

// Show message
function showMessage(message, type) {
    // Store current scroll position
    const currentScrollY = window.scrollY;
    
    // Remove existing messages
    const existingMessages = document.querySelectorAll('.success-message, .error-message');
    existingMessages.forEach(msg => msg.remove());

    const messageDiv = document.createElement('div');
    messageDiv.className = type === 'success' ? 'success-message' : 'error-message';
    messageDiv.textContent = message;
    
    // Add smooth fade-in animation
    messageDiv.style.opacity = '0';
    messageDiv.style.transition = 'opacity 0.3s ease-in-out';

    // Insert at the top of the active section
    const activeSection = document.querySelector('.section.active');
    if (activeSection) {
        const firstCard = activeSection.querySelector('.card');
        if (firstCard) {
            firstCard.parentNode.insertBefore(messageDiv, firstCard);
        }
    }
    
    // Restore scroll position immediately
    window.scrollTo(0, currentScrollY);
    
    // Fade in the message
    setTimeout(() => {
        messageDiv.style.opacity = '1';
    }, 10);

    // Remove message after 3 seconds with fade out
    setTimeout(() => {
        messageDiv.style.opacity = '0';
        setTimeout(() => {
            if (messageDiv.parentNode) {
                messageDiv.remove();
            }
        }, 300);
    }, 3000);
}
