// Default Supabase Configuration (Paste your keys here for out-of-the-box configuration!)
const DEFAULT_SUPABASE_URL = 'https://ernjkqamkjlatjodfjdg.supabase.co';
const DEFAULT_SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVybmprcWFta2psYXRqb2RmamRnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI4ODAxNTQsImV4cCI6MjA5ODQ1NjE1NH0.ropQKVC_T5CSpaeLipHCRNzAYUrzEP14Wktb02q0yiw';

// State Management
let state = {
    tasks: [],
    activeTab: 'dashboard',
    searchQuery: '',
    statusFilter: 'all',
    categoryFilter: 'all',
    priorityFilter: 'all',
    sortBy: 'due-date',
    theme: 'dark',
    calendarDate: new Date(),
    calendarView: 'month',
    supabase: null,
    useSupabase: false,
    documents: [],
    activeDocumentId: null,
    docAutosaveTimer: null,
    userId: null
};

// Default Pre-seeded Tasks for initial wow-factor
const defaultTasks = [
    {
        id: 'task-1',
        title: 'Launch Ultimate Task Manager',
        desc: 'Review interface layout, finish JavaScript state engine, and style beautiful glassmorphic visual indicators.',
        category: 'Work',
        priority: 'High',
        dueDate: new Date().toISOString().split('T')[0], // Today
        completed: false,
        subtasks: [
            { id: 'sub-1', title: 'Code CSS layout', completed: true },
            { id: 'sub-2', title: 'Implement JS state', completed: true },
            { id: 'sub-3', title: 'Add slide-over modal editor', completed: false }
        ],
        tags: ['project', 'design', 'v1.0']
    },
    {
        id: 'task-2',
        title: 'Renew gym membership',
        desc: 'Check local fitness center offers and lock in the yearly productivity discount.',
        category: 'Wellness',
        priority: 'Medium',
        dueDate: (() => {
            const d = new Date();
            d.setDate(d.getDate() + 3);
            return d.toISOString().split('T')[0];
        })(), // Today + 3 days
        completed: false,
        subtasks: [],
        tags: ['fitness', 'health']
    },
    {
        id: 'task-3',
        title: 'Organize design system guidelines',
        desc: 'Export asset logos, choose premium fonts, and draft typography hierarchy rules for developers.',
        category: 'Work',
        priority: 'Low',
        dueDate: (() => {
            const d = new Date();
            d.setDate(d.getDate() - 2);
            return d.toISOString().split('T')[0];
        })(), // Overdue
        completed: false,
        subtasks: [
            { id: 'sub-4', title: 'Audit current color rules', completed: true },
            { id: 'sub-5', title: 'Draft AGY guidelines', completed: false }
        ],
        tags: ['documentation', 'ui-ux']
    },
    {
        id: 'task-4',
        title: 'Weekly grocery shopping',
        desc: 'Pick up fresh vegetables, almond milk, and meal prep boxes for the coming days.',
        category: 'Shopping',
        priority: 'Low',
        dueDate: (() => {
            const d = new Date();
            d.setDate(d.getDate() + 1);
            return d.toISOString().split('T')[0];
        })(), // Tomorrow
        completed: true,
        subtasks: [],
        tags: ['errand']
    }
];

// Pre-seeded standard categories
const presetCategories = ['Work', 'Personal', 'Shopping', 'Wellness'];

// Initialize App
document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    initDateTime();
    initEventListeners();
    initSupabase().then(() => {
        render();
        lucide.createIcons();
    });

    // Register PWA Service Worker
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('./sw.js')
            .then(reg => console.log('AetherTask Service Worker registered:', reg.scope))
            .catch(err => console.error('Service Worker registration failed:', err));
    }
});

// Theme Setup
function initTheme() {
    const savedTheme = localStorage.getItem('theme') || 'dark';
    state.theme = savedTheme;
    if (savedTheme === 'light') {
        document.body.classList.remove('dark-theme');
        document.body.classList.add('light-theme');
    } else {
        document.body.classList.add('dark-theme');
        document.body.classList.remove('light-theme');
    }
}

// Current Date Heading
function initDateTime() {
    const options = { weekday: 'long', month: 'long', day: 'numeric' };
    const today = new Date();
    document.getElementById('current-date').textContent = today.toLocaleDateString('en-US', options);
    
    // Greeting depending on time of day
    const hour = today.getHours();
    let greeting = 'Hello, Master';
    if (hour < 12) greeting = 'Good Morning, Master';
    else if (hour < 18) greeting = 'Good Afternoon, Master';
    else greeting = 'Good Evening, Master';
    
    document.getElementById('greeting').textContent = greeting;
}

// Storage Helpers
async function loadTasks() {
    if (state.useSupabase && state.supabase) {
        try {
            const { data, error } = await state.supabase.from('tasks').select('*');
            if (error) throw error;
            
            if (data && data.length > 0) {
                state.tasks = data;
            } else {
                // Seed database if empty
                const seeded = defaultTasks.map(t => ({ ...t, user_id: getUserId() }));
                const { error: seedError } = await state.supabase.from('tasks').insert(seeded);
                if (seedError) throw seedError;
                state.tasks = [...seeded];
            }
        } catch (err) {
            console.error('Failed to load tasks from Supabase:', err);
            showToast('Failed to load tasks from cloud database. Falling back to offline mode.', 'warning');
            updateSyncStatusUI('connection-error', 'Sync Error');
            loadLocalTasks();
        }
    } else {
        loadLocalTasks();
    }
}

function loadLocalTasks() {
    const local = localStorage.getItem('aethertasks');
    if (local) {
        state.tasks = JSON.parse(local);
    } else {
        state.tasks = [...defaultTasks];
        saveTasks();
    }
}

function saveTasks() {
    localStorage.setItem('aethertasks', JSON.stringify(state.tasks));
}

// Event Listeners Routing
function initEventListeners() {
    // Navigation Links
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const tab = e.currentTarget.getAttribute('data-tab');
            switchTab(tab);
        });
    });

    // Theme Toggle
    document.getElementById('theme-toggle-btn').addEventListener('click', toggleTheme);

    // Create Task Modal Trigger Buttons
    document.getElementById('btn-create-task').addEventListener('click', () => openTaskModal());
    document.getElementById('btn-empty-create').addEventListener('click', () => openTaskModal());
    document.getElementById('btn-view-all-tasks').addEventListener('click', () => switchTab('tasks'));

    // Modal Cancel/Close Events
    document.getElementById('btn-close-modal').addEventListener('click', closeTaskModal);
    document.getElementById('btn-cancel-modal').addEventListener('click', closeTaskModal);
    
    // Click outside modal overlay to close
    document.getElementById('task-modal').addEventListener('click', (e) => {
        if (e.target.id === 'task-modal') closeTaskModal();
    });

    // Subtask Checklist addition in Modal
    document.getElementById('btn-add-subtask-input').addEventListener('click', () => addSubtaskInputField());

    // Task Form Submission
    document.getElementById('task-form').addEventListener('submit', handleTaskFormSubmit);

    // Quick Add Dashboard Form Submission
    document.getElementById('quick-add-form').addEventListener('submit', handleQuickAddSubmit);

    // Global Search Live Filters
    document.getElementById('global-search').addEventListener('input', (e) => {
        state.searchQuery = e.target.value;
        // If searching, automatically jump to tasks list tab if on dashboard, for convenience
        if (state.activeTab === 'dashboard' && state.searchQuery.trim().length > 0) {
            switchTab('tasks');
        }
        renderTaskList();
    });

    // Control Bar Filters
    document.querySelectorAll('[data-status-filter]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('[data-status-filter]').forEach(b => b.classList.remove('active'));
            e.currentTarget.classList.add('active');
            state.statusFilter = e.currentTarget.getAttribute('data-status-filter');
            renderTaskList();
        });
    });

    // Select Filter Dropdowns
    document.getElementById('category-select').addEventListener('change', (e) => {
        state.categoryFilter = e.target.value;
        renderTaskList();
    });
    
    document.getElementById('priority-select').addEventListener('change', (e) => {
        state.priorityFilter = e.target.value;
        renderTaskList();
    });

    document.getElementById('sort-select').addEventListener('change', (e) => {
        state.sortBy = e.target.value;
        renderTaskList();
    });

    // Metric Cards quick dashboard filter
    document.querySelectorAll('.metric-card').forEach(card => {
        card.addEventListener('click', (e) => {
            const filter = e.currentTarget.getAttribute('data-filter');
            switchTab('tasks');
            
            // Set active status filter button
            document.querySelectorAll('[data-status-filter]').forEach(b => {
                if (b.getAttribute('data-status-filter') === filter) {
                    b.classList.add('active');
                } else {
                    b.classList.remove('active');
                }
            });
            
            // Apply corresponding status filter
            state.statusFilter = filter;
            renderTaskList();
        });
    });

    // Calendar Navigation events
    document.getElementById('btn-calendar-prev').addEventListener('click', goToPrevDate);
    document.getElementById('btn-calendar-next').addEventListener('click', goToNextDate);
    document.getElementById('btn-calendar-today').addEventListener('click', goToToday);

    // Calendar View toggles
    document.querySelectorAll('[data-calendar-view]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            state.calendarView = e.currentTarget.getAttribute('data-calendar-view');
            renderCalendar();
        });
    });

    // Supabase Sync events
    document.getElementById('btn-configure-sync').addEventListener('click', () => openSupabaseModal());
    document.getElementById('btn-close-supabase-modal').addEventListener('click', closeSupabaseModal);
    document.getElementById('supabase-modal').addEventListener('click', (e) => {
        if (e.target.id === 'supabase-modal') closeSupabaseModal();
    });
    document.getElementById('supabase-config-form').addEventListener('submit', handleSupabaseConfigSubmit);
    document.getElementById('btn-disconnect-supabase').addEventListener('click', disconnectSupabase);

    // Documents Tab events
    document.getElementById('btn-create-doc').addEventListener('click', createDocument);

    // Auth Login form
    document.getElementById('auth-login-form').addEventListener('submit', handleLogin);
}

// Tab Swapping Action
function switchTab(tabName) {
    state.activeTab = tabName;
    
    // Toggle active state on buttons
    document.querySelectorAll('.nav-btn').forEach(btn => {
        if (btn.getAttribute('data-tab') === tabName) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });

    // Toggle Tab view containers
    document.querySelectorAll('.tab-panel').forEach(panel => {
        if (panel.id === `${tabName}-view`) {
            panel.classList.add('active');
        } else {
            panel.classList.remove('active');
        }
    });

    // Trigger targeted renders
    if (tabName === 'dashboard') {
        renderDashboard();
    } else if (tabName === 'calendar') {
        renderCalendar();
    } else if (tabName === 'documents') {
        renderDocuments();
    } else {
        renderTaskList();
    }
}

// Toggle light / dark mode themes
function toggleTheme() {
    if (state.theme === 'dark') {
        state.theme = 'light';
        document.body.classList.remove('dark-theme');
        document.body.classList.add('light-theme');
        showToast('Switched to Light Theme', 'info');
    } else {
        state.theme = 'dark';
        document.body.classList.add('dark-theme');
        document.body.classList.remove('light-theme');
        showToast('Switched to Dark Theme', 'info');
    }
    localStorage.setItem('theme', state.theme);
}

// Render Master Coordinator
function render() {
    renderStats();
    renderSidebarCategories();
    renderCategoryFilterSelect();
    
    if (state.activeTab === 'dashboard') {
        renderDashboard();
    } else if (state.activeTab === 'calendar') {
        renderCalendar();
    } else {
        renderTaskList();
    }
}

// Compute Statistics Helper
function getStats() {
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    let stats = {
        total: state.tasks.length,
        completed: 0,
        pending: 0,
        overdue: 0
    };

    state.tasks.forEach(task => {
        if (task.completed) {
            stats.completed++;
        } else {
            stats.pending++;
            
            // Check overdue
            if (task.dueDate) {
                const taskDue = new Date(task.dueDate);
                taskDue.setHours(0, 0, 0, 0);
                if (taskDue < now) {
                    stats.overdue++;
                }
            }
        }
    });

    return stats;
}

// Render counters in Metrics grid
function renderStats() {
    const stats = getStats();
    document.getElementById('stat-total').textContent = stats.total;
    document.getElementById('stat-pending').textContent = stats.pending;
    document.getElementById('stat-completed').textContent = stats.completed;
    document.getElementById('stat-overdue').textContent = stats.overdue;
}

// Render Dashboard View Specific elements
function renderDashboard() {
    const stats = getStats();
    
    // Draw Radial Completion Ring
    const percentage = stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0;
    document.getElementById('completion-percentage').textContent = `${percentage}%`;
    
    // SVGCircle r=68 has circumference of 2 * PI * 68 = 427.2
    const ring = document.getElementById('dashboard-progress-ring');
    const strokeDashoffset = 427.2 - (percentage / 100) * 427.2;
    ring.style.strokeDashoffset = strokeDashoffset;

    // Render Category Distribution Widget
    const catList = document.getElementById('category-distribution-list');
    catList.innerHTML = '';
    
    const allCategories = getAllCategories();
    
    if (allCategories.length === 0) {
        catList.innerHTML = `<div class="subtext" style="color: var(--text-muted);">No task data to track.</div>`;
    }

    allCategories.forEach(cat => {
        const catTasks = state.tasks.filter(t => t.category === cat);
        const catCompleted = catTasks.filter(t => t.completed).length;
        const catTotal = catTasks.length;
        const catPercentage = catTotal > 0 ? Math.round((catCompleted / catTotal) * 100) : 0;
        
        const catColorClass = getCategoryColor(cat);

        const catItem = document.createElement('div');
        catItem.className = 'cat-dist-item';
        catItem.innerHTML = `
            <div class="cat-dist-header">
                <span class="cat-dist-name">${cat}</span>
                <span class="cat-dist-stat">${catCompleted}/${catTotal} (${catPercentage}%)</span>
            </div>
            <div class="progress-track">
                <div class="progress-bar" style="width: ${catPercentage}%; background-color: var(--accent-${catColorClass}); box-shadow: 0 0 8px var(--accent-${catColorClass});"></div>
            </div>
        `;
        catList.appendChild(catItem);
    });

    // Render Urgent & Upcoming tasks (Pending sorted by due date)
    const urgentList = document.getElementById('urgent-tasks-list');
    urgentList.innerHTML = '';
    
    const now = new Date();
    now.setHours(0,0,0,0);

    const pendingTasks = state.tasks
        .filter(t => !t.completed)
        .sort((a, b) => {
            if (!a.dueDate) return 1;
            if (!b.dueDate) return -1;
            return new Date(a.dueDate) - new Date(b.dueDate);
        });

    const displayUrgent = pendingTasks.slice(0, 3); // top 3 tasks

    if (displayUrgent.length === 0) {
        urgentList.innerHTML = `
            <div class="empty-state" style="display: flex; padding: 20px 0;">
                <p>No urgent tasks pending. You are all caught up!</p>
            </div>
        `;
    } else {
        displayUrgent.forEach(task => {
            const isOverdue = task.dueDate && new Date(task.dueDate) < now;
            let dueText = 'No due date';
            if (task.dueDate) {
                const dateObj = new Date(task.dueDate);
                dueText = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            }

            const item = document.createElement('div');
            item.className = 'recent-task-item';
            item.innerHTML = `
                <div class="recent-task-left">
                    <button class="checkbox-custom-btn" data-toggle-id="${task.id}" title="Complete Task">
                        <i data-lucide="check"></i>
                    </button>
                    <span class="recent-task-title" title="${task.title}">${task.title}</span>
                </div>
                <div class="recent-task-right">
                    <span class="priority-dot ${task.priority}" title="${task.priority} Priority"></span>
                    <span class="due-pill ${isOverdue ? 'overdue' : ''}">${dueText}</span>
                </div>
            `;
            
            // Attach toggle completion listener
            item.querySelector('.checkbox-custom-btn').addEventListener('click', (e) => {
                e.stopPropagation();
                toggleTaskComplete(task.id);
            });

            // Make whole item click switch to task tab and open description
            item.addEventListener('click', () => {
                switchTab('tasks');
                // Scroll or highlights could be implemented, but simple tab switch for now
            });

            urgentList.appendChild(item);
        });
        lucide.createIcons();
    }
}

// Render dynamic Category lists in sidebar
function renderSidebarCategories() {
    const list = document.getElementById('sidebar-categories');
    list.innerHTML = '';

    const allCategories = presetCategories;
    
    // Add All Tasks pseudo category
    const totalPendingCount = state.tasks.filter(t => !t.completed).length;

    allCategories.forEach(cat => {
        const count = state.tasks.filter(t => t.category === cat && !t.completed).length;
        const colorClass = getCategoryColor(cat);
        const isActive = state.activeTab === 'tasks' && state.categoryFilter === cat;

        const li = document.createElement('li');
        li.innerHTML = `
            <div class="category-nav-item ${isActive ? 'active' : ''}" data-sidebar-cat="${cat}">
                <div class="category-name-wrapper">
                    <span class="category-color-dot" style="background-color: var(--accent-${colorClass});"></span>
                    <span>${cat}</span>
                </div>
                <span class="category-count">${count}</span>
            </div>
        `;

        li.querySelector('.category-nav-item').addEventListener('click', () => {
            state.categoryFilter = cat;
            switchTab('tasks');
            
            // Update the category filter select element
            const selectEl = document.getElementById('category-select');
            if (selectEl) {
                selectEl.value = cat;
            }
            renderTaskList();
        });

        list.appendChild(li);
    });
}

// Render task list categories selector
function renderCategoryFilterSelect() {
    const select = document.getElementById('category-select');
    if (!select) return;
    
    const currentValue = select.value || 'all';
    
    select.innerHTML = '<option value="all">All Categories</option>';
    presetCategories.forEach(cat => {
        const option = document.createElement('option');
        option.value = cat;
        option.textContent = cat;
        select.appendChild(option);
    });
    
    select.value = currentValue;
}

// Category helper color classes
function getCategoryColor(category) {
    switch (category) {
        case 'Work': return 'violet';
        case 'Personal': return 'teal';
        case 'Shopping': return 'amber';
        case 'Wellness': return 'rose';
        default: return 'violet';
    }
}

// Helper to scrape all unique categories used in tasks
function getAllCategories() {
    const unique = new Set(presetCategories);
    state.tasks.forEach(t => {
        if (t.category) unique.add(t.category);
    });
    return Array.from(unique);
}

// Render all individual task cards under Tasks view
function renderTaskList() {
    const grid = document.getElementById('tasks-grid');
    const emptyState = document.getElementById('tasks-empty-state');
    grid.innerHTML = '';

    const now = new Date();
    now.setHours(0,0,0,0);

    // Apply filtering steps
    let filteredTasks = state.tasks.filter(task => {
        // 1. Status Filter
        if (state.statusFilter === 'active' && task.completed) return false;
        if (state.statusFilter === 'completed' && !task.completed) return false;
        if (state.statusFilter === 'overdue') {
            if (task.completed || !task.dueDate) return false;
            const taskDue = new Date(task.dueDate);
            taskDue.setHours(0, 0, 0, 0);
            if (taskDue >= now) return false;
        }

        // 2. Category Dropdown Filter
        if (state.categoryFilter !== 'all' && task.category !== state.categoryFilter) return false;

        // 3. Priority Dropdown Filter
        if (state.priorityFilter !== 'all' && task.priority !== state.priorityFilter) return false;

        // 4. Live Search Filter
        if (state.searchQuery.trim() !== '') {
            const query = state.searchQuery.toLowerCase();
            const titleMatch = task.title.toLowerCase().includes(query);
            const descMatch = task.desc && task.desc.toLowerCase().includes(query);
            const tagMatch = task.tags.some(tag => tag.toLowerCase().includes(query));
            if (!titleMatch && !descMatch && !tagMatch) return false;
        }

        return true;
    });

    // Apply Sorting steps
    filteredTasks.sort((a, b) => {
        if (state.sortBy === 'due-date') {
            if (!a.dueDate) return 1;
            if (!b.dueDate) return -1;
            return new Date(a.dueDate) - new Date(b.dueDate);
        }
        
        if (state.sortBy === 'title') {
            return a.title.localeCompare(b.title);
        }
        
        // Priority weightings: High = 3, Medium = 2, Low = 1
        const priorityWeight = (p) => {
            if (p === 'High') return 3;
            if (p === 'Medium') return 2;
            return 1;
        };

        if (state.sortBy === 'priority-desc') {
            return priorityWeight(b.priority) - priorityWeight(a.priority);
        }
        
        if (state.sortBy === 'priority-asc') {
            return priorityWeight(a.priority) - priorityWeight(b.priority);
        }

        return 0;
    });

    // Check empty state
    if (filteredTasks.length === 0) {
        grid.style.display = 'none';
        emptyState.style.display = 'flex';
    } else {
        grid.style.display = 'grid';
        emptyState.style.display = 'none';

        filteredTasks.forEach(task => {
            const card = createTaskCardElement(task, now);
            grid.appendChild(card);
        });
        
        lucide.createIcons();
    }
}

// Generate the task HTML structure card
function createTaskCardElement(task, nowDate) {
    const isOverdue = !task.completed && task.dueDate && new Date(task.dueDate) < nowDate;
    
    let dueText = 'No due date';
    if (task.dueDate) {
        const dateObj = new Date(task.dueDate);
        dueText = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }

    const card = document.createElement('div');
    card.className = `task-card glass-panel ${task.completed ? 'completed' : ''}`;
    card.id = `card-${task.id}`;

    // Subtask count formatting
    let subtasksHTML = '';
    if (task.subtasks && task.subtasks.length > 0) {
        const completedCount = task.subtasks.filter(s => s.completed).length;
        const totalCount = task.subtasks.length;
        const percent = Math.round((completedCount / totalCount) * 100);

        subtasksHTML = `
            <div class="task-subtasks-summary" title="Subtask progress">
                <i data-lucide="list-todo"></i>
                <span>${completedCount}/${totalCount} Subtasks</span>
                <div class="subtask-mini-progress-bar">
                    <div class="subtask-mini-progress-fill" style="width: ${percent}%;"></div>
                </div>
            </div>
            <div class="subtasks-detail-list" style="margin-left: 32px; display: none; margin-bottom: 12px;">
                ${task.subtasks.map(sub => `
                    <label class="subtask-item-label" style="display: flex; align-items: center; gap: 8px; font-size: 12.5px; margin-bottom: 4px; color: ${sub.completed ? 'var(--text-muted)' : 'var(--text-secondary)'}">
                        <input type="checkbox" class="subtask-checkbox" data-task-id="${task.id}" data-subtask-id="${sub.id}" ${sub.completed ? 'checked' : ''} style="accent-color: var(--accent-teal);">
                        <span style="${sub.completed ? 'text-decoration: line-through;' : ''}">${sub.title}</span>
                    </label>
                `).join('')}
            </div>
        `;
    }

    // Tags badge list mapping
    const tagsHTML = task.tags.map(tag => `<span class="tag-badge">#${tag}</span>`).join('');

    card.innerHTML = `
        <div class="task-card-header">
            <span class="task-category-badge">${task.category}</span>
            <span class="task-priority-badge ${task.priority}">${task.priority}</span>
        </div>
        <div class="task-card-body">
            <div class="task-card-title-row">
                <button class="checkbox-custom-btn task-checkbox" data-toggle-id="${task.id}" title="Toggle Complete">
                    <i data-lucide="check"></i>
                </button>
                <span class="task-title-text">${task.title}</span>
            </div>
            <p class="task-desc-text">${task.desc || 'No description provided.'}</p>
            ${subtasksHTML}
            <div class="task-tags-list">
                ${tagsHTML}
            </div>
        </div>
        <div class="task-card-footer">
            <span class="task-due-date-pill ${isOverdue ? 'overdue' : ''}">
                <i data-lucide="calendar"></i>
                <span>${dueText} ${isOverdue ? '(Overdue)' : ''}</span>
            </span>
            <div class="task-card-actions">
                <button class="btn-card-action edit" data-edit-id="${task.id}" title="Edit Task">
                    <i data-lucide="edit-3"></i>
                </button>
                <button class="btn-card-action delete" data-delete-id="${task.id}" title="Delete Task">
                    <i data-lucide="trash-2"></i>
                </button>
            </div>
        </div>
    `;

    // Toggle complete click handler on custom checkbox button
    card.querySelector('.task-checkbox').addEventListener('click', (e) => {
        e.stopPropagation();
        toggleTaskComplete(task.id);
    });

    // Expand/Collapse subtask checklist details when clicking subtask indicator
    const subtaskSummary = card.querySelector('.task-subtasks-summary');
    if (subtaskSummary) {
        subtaskSummary.addEventListener('click', (e) => {
            e.stopPropagation();
            const details = card.querySelector('.subtasks-detail-list');
            const isHidden = details.style.display === 'none';
            details.style.display = isHidden ? 'block' : 'none';
        });
    }

    // Subtasks checkbox change listeners
    card.querySelectorAll('.subtask-checkbox').forEach(chk => {
        chk.addEventListener('change', (e) => {
            const taskId = e.target.getAttribute('data-task-id');
            const subId = e.target.getAttribute('data-subtask-id');
            toggleSubtaskComplete(taskId, subId);
        });
    });

    // Edit button click event
    card.querySelector('.btn-card-action.edit').addEventListener('click', (e) => {
        e.stopPropagation();
        openTaskModal(task);
    });

    // Delete button click event
    card.querySelector('.btn-card-action.delete').addEventListener('click', (e) => {
        e.stopPropagation();
        deleteTask(task.id);
    });

    // Double-click to Edit card helper
    card.addEventListener('dblclick', () => {
        openTaskModal(task);
    });

    return card;
}

// Complete CRUD Handlers
async function toggleTaskComplete(id) {
    const taskIndex = state.tasks.findIndex(t => t.id === id);
    if (taskIndex !== -1) {
        const wasCompleted = state.tasks[taskIndex].completed;
        const task = state.tasks[taskIndex];
        task.completed = !wasCompleted;
        
        // Auto check/uncheck subtasks when parent task toggled
        if (task.subtasks) {
            task.subtasks.forEach(sub => {
                sub.completed = !wasCompleted;
            });
        }

        saveTasks();

        if (state.useSupabase && state.supabase) {
            try {
                const { error } = await state.supabase
                    .from('tasks')
                    .update({ completed: task.completed, subtasks: task.subtasks })
                    .eq('id', id);
                if (error) throw error;
            } catch (err) {
                console.error('Supabase toggle error:', err);
                showToast('Failed to sync change to server.', 'warning');
            }
        }

        renderStats();
        renderSidebarCategories();
        
        if (state.activeTab === 'dashboard') {
            renderDashboard();
        } else if (state.activeTab === 'calendar') {
            renderCalendar();
        } else {
            renderTaskList();
        }

        if (!wasCompleted) {
            showToast('Task marked as Completed! Good job.', 'success');
        } else {
            showToast('Task marked as Active.', 'info');
        }
    }
}

async function toggleSubtaskComplete(taskId, subtaskId) {
    const task = state.tasks.find(t => t.id === taskId);
    if (task) {
        const subtask = task.subtasks.find(s => s.id === subtaskId);
        if (subtask) {
            subtask.completed = !subtask.completed;
            
            // If all subtasks are finished, check if we should complete parent or just alert
            const allSubtasksDone = task.subtasks.every(s => s.completed);
            if (allSubtasksDone && !task.completed) {
                task.completed = true;
                showToast('All subtasks completed! Task closed.', 'success');
            } else if (!allSubtasksDone && task.completed) {
                task.completed = false;
                showToast('Subtask re-opened. Task re-activated.', 'info');
            }

            saveTasks();

            if (state.useSupabase && state.supabase) {
                try {
                    const { error } = await state.supabase
                        .from('tasks')
                        .update({ completed: task.completed, subtasks: task.subtasks })
                        .eq('id', taskId);
                    if (error) throw error;
                } catch (err) {
                    console.error('Supabase subtask update error:', err);
                    showToast('Failed to sync changes to server.', 'warning');
                }
            }

            renderStats();
            renderSidebarCategories();
            
            if (state.activeTab === 'dashboard') {
                renderDashboard();
            } else if (state.activeTab === 'calendar') {
                renderCalendar();
            } else {
                renderTaskList();
            }
        }
    }
}

async function deleteTask(id) {
    const task = state.tasks.find(t => t.id === id);
    const index = state.tasks.findIndex(t => t.id === id);
    if (index !== -1) {
        state.tasks.splice(index, 1);
        saveTasks();

        if (state.useSupabase && state.supabase) {
            try {
                const { error } = await state.supabase
                    .from('tasks')
                    .delete()
                    .eq('id', id);
                if (error) throw error;
            } catch (err) {
                console.error('Supabase delete error:', err);
                showToast('Failed to delete task from server.', 'warning');
            }
        }

        render();
        showToast(`"${task.title}" has been deleted.`, 'warning');
    }
}

// Modal Creation / Editing Form Dialog Control
let currentSubtaskCount = 0;

function openTaskModal(taskToEdit = null) {
    const modal = document.getElementById('task-modal');
    const form = document.getElementById('task-form');
    form.reset();

    // Clear previous dynamic subtask rows
    document.getElementById('modal-subtask-list').innerHTML = '';
    currentSubtaskCount = 0;

    if (taskToEdit && taskToEdit.id) {
        // Edit Mode
        document.getElementById('modal-title').textContent = 'Edit Task';
        document.getElementById('submit-btn-text').textContent = 'Save Changes';
        document.getElementById('task-id').value = taskToEdit.id;
        document.getElementById('task-title').value = taskToEdit.title;
        document.getElementById('task-desc').value = taskToEdit.desc || '';
        document.getElementById('task-category-select').value = taskToEdit.category || 'Work';
        document.getElementById('task-due-date').value = taskToEdit.dueDate || '';
        
        // Priority radio check
        document.querySelectorAll('input[name="priority"]').forEach(radio => {
            if (radio.value === taskToEdit.priority) {
                radio.checked = true;
            }
        });

        document.getElementById('task-tags').value = taskToEdit.tags.join(', ');

        // Populate edit checklist
        if (taskToEdit.subtasks && taskToEdit.subtasks.length > 0) {
            taskToEdit.subtasks.forEach(sub => {
                addSubtaskInputField(sub.title);
            });
        }
    } else {
        // Create Mode (with optional pre-filled values from calendar/quick clicks)
        document.getElementById('modal-title').textContent = 'Create New Task';
        document.getElementById('submit-btn-text').textContent = 'Create Task';
        document.getElementById('task-id').value = '';
        
        if (taskToEdit) {
            document.getElementById('task-title').value = taskToEdit.title || '';
            document.getElementById('task-desc').value = taskToEdit.desc || '';
            document.getElementById('task-category-select').value = taskToEdit.category || 'Work';
            document.getElementById('task-due-date').value = taskToEdit.dueDate || '';
            document.querySelectorAll('input[name="priority"]').forEach(radio => {
                if (radio.value === (taskToEdit.priority || 'Medium')) {
                    radio.checked = true;
                }
            });
            document.getElementById('task-tags').value = taskToEdit.tags ? taskToEdit.tags.join(', ') : '';
        } else {
            // default today's date for ease
            const today = new Date().toISOString().split('T')[0];
            document.getElementById('task-due-date').value = today;
        }
    }

    modal.classList.add('active');
    document.getElementById('task-title').focus();
    lucide.createIcons();
}

function closeTaskModal() {
    document.getElementById('task-modal').classList.remove('active');
}

// Add a subtask text row inside creation modal
function addSubtaskInputField(value = '') {
    const container = document.getElementById('modal-subtask-list');
    currentSubtaskCount++;
    
    const row = document.createElement('div');
    row.className = 'subtask-input-item';
    row.id = `subtask-input-row-${currentSubtaskCount}`;
    row.innerHTML = `
        <input type="text" class="subtask-input-text-field" placeholder="Subtask detail name..." value="${value}" autocomplete="off">
        <button type="button" class="btn-card-action delete" onclick="document.getElementById('subtask-input-row-${currentSubtaskCount}').remove();" title="Remove Item">
            <i data-lucide="trash-2"></i>
        </button>
    `;
    
    container.appendChild(row);
    lucide.createIcons();
    row.querySelector('input').focus();
}

// Handle submitting Form
async function handleTaskFormSubmit(e) {
    e.preventDefault();

    const taskId = document.getElementById('task-id').value;
    const title = document.getElementById('task-title').value.trim();
    const desc = document.getElementById('task-desc').value.trim();
    const category = document.getElementById('task-category-select').value;
    const dueDate = document.getElementById('task-due-date').value;
    const priority = document.querySelector('input[name="priority"]:checked').value;
    
    // Parse tag lists
    const rawTags = document.getElementById('task-tags').value;
    const tags = rawTags.split(',')
        .map(t => t.trim().toLowerCase())
        .filter(t => t !== '');

    // Scrape subtasks inputs
    const subtaskInputs = document.querySelectorAll('.subtask-input-text-field');
    const newSubtasks = [];
    
    // Check if we are updating an existing task to keep checked statuses
    const existingTask = state.tasks.find(t => t.id === taskId);

    subtaskInputs.forEach((input, index) => {
        const val = input.value.trim();
        if (val !== '') {
            let isDone = false;
            if (existingTask && existingTask.subtasks[index]) {
                isDone = existingTask.subtasks[index].completed;
            }
            newSubtasks.push({
                id: `sub-${Date.now()}-${index}`,
                title: val,
                completed: isDone
            });
        }
    });

    if (taskId) {
        // EDIT MODE UPDATE
        const taskIndex = state.tasks.findIndex(t => t.id === taskId);
        if (taskIndex !== -1) {
            const updatedFields = {
                title,
                desc,
                category,
                dueDate,
                priority,
                tags,
                subtasks: newSubtasks
            };
            
            state.tasks[taskIndex] = {
                ...state.tasks[taskIndex],
                ...updatedFields
            };
            
            // Re-evaluate main completion if subtask edits made
            if (newSubtasks.length > 0) {
                const allDone = newSubtasks.every(s => s.completed);
                if (allDone && !state.tasks[taskIndex].completed) {
                    state.tasks[taskIndex].completed = true;
                    updatedFields.completed = true;
                } else if (!allDone && state.tasks[taskIndex].completed) {
                    state.tasks[taskIndex].completed = false;
                    updatedFields.completed = false;
                }
            }

            saveTasks();

            if (state.useSupabase && state.supabase) {
                try {
                    const { error } = await state.supabase
                        .from('tasks')
                        .update(updatedFields)
                        .eq('id', taskId);
                    if (error) throw error;
                } catch (err) {
                    console.error('Supabase edit error:', err);
                    showToast('Failed to sync updates to server.', 'warning');
                }
            }

            showToast('Task updated successfully.', 'success');
        }
    } else {
        // CREATE NEW MODE
        const newTask = {
            id: `task-${Date.now()}`,
            title,
            desc,
            category,
            dueDate,
            priority,
            tags,
            completed: false,
            subtasks: newSubtasks,
            user_id: getUserId()
        };
        state.tasks.push(newTask);
        saveTasks();

        if (state.useSupabase && state.supabase) {
            try {
                const { error } = await state.supabase
                    .from('tasks')
                    .insert([newTask]);
                if (error) throw error;
            } catch (err) {
                console.error('Supabase insert error:', err);
                showToast('Failed to sync new task to server.', 'warning');
            }
        }

        showToast('New Task Created!', 'success');
    }

    closeTaskModal();
    render();
}

// Quick Add Form from Dashboard
async function handleQuickAddSubmit(e) {
    e.preventDefault();
    const titleInput = document.getElementById('quick-add-title');
    const title = titleInput.value.trim();
    if (title === '') return;

    const category = document.getElementById('quick-add-category').value;
    const priority = document.getElementById('quick-add-priority').value;

    const newTask = {
        id: `task-${Date.now()}`,
        title,
        desc: '',
        category,
        dueDate: new Date().toISOString().split('T')[0], // Default today
        priority,
        tags: [],
        completed: false,
        subtasks: [],
        user_id: getUserId()
    };

    state.tasks.push(newTask);
    saveTasks();

    if (state.useSupabase && state.supabase) {
        try {
            const { error } = await state.supabase
                .from('tasks')
                .insert([newTask]);
            if (error) throw error;
        } catch (err) {
            console.error('Supabase insert error:', err);
            showToast('Failed to sync quick-added task.', 'warning');
        }
    }

    titleInput.value = '';
    
    render();
    showToast('Task quick-added!', 'success');
}

// Toast System Control
function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = 'toast';
    
    let icon = 'check-circle-2';
    if (type === 'warning') icon = 'alert-triangle';
    if (type === 'info') icon = 'info';

    toast.innerHTML = `
        <div class="toast-icon ${type}">
            <i data-lucide="${icon}"></i>
        </div>
        <span>${message}</span>
    `;

    container.appendChild(toast);
    lucide.createIcons();

    // Slide out after 3.5 seconds
    setTimeout(() => {
        toast.classList.add('removing');
        toast.addEventListener('animationend', () => {
            toast.remove();
        });
    }, 3500);
}

// ==========================================
// CALENDAR VIEW MODULE
// ==========================================

function goToPrevDate() {
    const d = new Date(state.calendarDate);
    if (state.calendarView === 'month') {
        d.setMonth(d.getMonth() - 1);
    } else if (state.calendarView === 'week') {
        d.setDate(d.getDate() - 7);
    } else {
        d.setDate(d.getDate() - 1);
    }
    state.calendarDate = d;
    renderCalendar();
}

function goToNextDate() {
    const d = new Date(state.calendarDate);
    if (state.calendarView === 'month') {
        d.setMonth(d.getMonth() + 1);
    } else if (state.calendarView === 'week') {
        d.setDate(d.getDate() + 7);
    } else {
        d.setDate(d.getDate() + 1);
    }
    state.calendarDate = d;
    renderCalendar();
}

function goToToday() {
    state.calendarDate = new Date();
    renderCalendar();
}

function formatDateKey(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

function renderCalendar() {
    const container = document.getElementById('calendar-content-area');
    const titleEl = document.getElementById('calendar-view-title');
    if (!container || !titleEl) return;

    // Update view switcher styling
    document.querySelectorAll('[data-calendar-view]').forEach(btn => {
        if (btn.getAttribute('data-calendar-view') === state.calendarView) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });

    if (state.calendarView === 'month') {
        renderMonthView(container, titleEl);
    } else if (state.calendarView === 'week') {
        renderWeekView(container, titleEl);
    } else {
        renderDayView(container, titleEl);
    }

    lucide.createIcons();
}

function renderMonthView(container, titleEl) {
    const d = state.calendarDate;
    const year = d.getFullYear();
    const month = d.getMonth();
    
    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    titleEl.textContent = `${monthNames[month]} ${year}`;

    let html = `<div class="calendar-grid">`;
    
    const daysOfWeek = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    daysOfWeek.forEach(day => {
        html += `<div class="calendar-day-header">${day}</div>`;
    });

    const firstDayIndex = new Date(year, month, 1).getDay();
    const totalDays = new Date(year, month + 1, 0).getDate();
    const prevTotalDays = new Date(year, month, 0).getDate();
    
    const todayStr = formatDateKey(new Date());

    // Prepend days from previous month
    for (let i = firstDayIndex - 1; i >= 0; i--) {
        const cellDate = new Date(year, month - 1, prevTotalDays - i);
        html += renderDayCellHTML(cellDate, true, todayStr);
    }

    // Add days of current month
    for (let i = 1; i <= totalDays; i++) {
        const cellDate = new Date(year, month, i);
        html += renderDayCellHTML(cellDate, false, todayStr);
    }

    // Append days from next month
    const totalCellsSoFar = firstDayIndex + totalDays;
    const remainingCells = (7 - (totalCellsSoFar % 7)) % 7;
    for (let i = 1; i <= remainingCells; i++) {
        const cellDate = new Date(year, month + 1, i);
        html += renderDayCellHTML(cellDate, true, todayStr);
    }
    
    const totalGridCells = totalCellsSoFar + remainingCells;
    if (totalGridCells < 42) {
        for (let i = remainingCells + 1; i <= remainingCells + 7; i++) {
            const cellDate = new Date(year, month + 1, i - remainingCells);
            html += renderDayCellHTML(cellDate, true, todayStr);
        }
    }

    html += `</div>`;
    container.innerHTML = html;

    attachCalendarCellListeners(container);
}

function renderDayCellHTML(date, isOtherMonth, todayStr) {
    const dateKey = formatDateKey(date);
    const dayNumber = date.getDate();
    const isToday = dateKey === todayStr;
    
    const dayTasks = state.tasks.filter(t => t.dueDate === dateKey);

    let pillsHTML = '<div class="calendar-task-pills">';
    dayTasks.forEach(task => {
        pillsHTML += `
            <div class="calendar-task-pill ${task.priority} ${task.completed ? 'completed' : ''}" data-task-id="${task.id}" title="${task.title}">
                <span class="priority-dot ${task.priority}"></span>
                <span>${task.title}</span>
            </div>
        `;
    });
    pillsHTML += '</div>';

    return `
        <div class="calendar-day-cell glass-panel ${isOtherMonth ? 'other-month' : ''} ${isToday ? 'today' : ''}" data-date="${dateKey}">
            <span class="calendar-day-number">${dayNumber}</span>
            ${pillsHTML}
            <button class="calendar-add-task-btn" data-date="${dateKey}" title="Add task for this day">
                <i data-lucide="plus"></i>
            </button>
        </div>
    `;
}

function renderWeekView(container, titleEl) {
    const curr = new Date(state.calendarDate);
    const first = curr.getDate() - curr.getDay();
    
    const startOfWeek = new Date(curr.setDate(first));
    const endOfWeek = new Date(curr.setDate(first + 6));

    const options = { month: 'short', day: 'numeric' };
    titleEl.textContent = `${startOfWeek.toLocaleDateString('en-US', options)} - ${endOfWeek.toLocaleDateString('en-US', { ...options, year: 'numeric' })}`;

    let html = `<div class="calendar-weekly-view">`;
    const todayStr = formatDateKey(new Date());

    const daysOfWeek = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

    for (let i = 0; i < 7; i++) {
        const dayDate = new Date(startOfWeek);
        dayDate.setDate(startOfWeek.getDate() + i);
        const dateKey = formatDateKey(dayDate);
        const isToday = dateKey === todayStr;

        const dayTasks = state.tasks.filter(t => t.dueDate === dateKey);

        let tasksHTML = '';
        dayTasks.forEach(task => {
            tasksHTML += `
                <div class="calendar-weekly-card glass-panel ${task.priority} ${task.completed ? 'completed' : ''}" data-task-id="${task.id}">
                    <div class="weekly-card-header">
                        <span class="task-category-badge">${task.category}</span>
                        <span class="priority-dot ${task.priority}"></span>
                    </div>
                    <div class="weekly-card-title">${task.title}</div>
                </div>
            `;
        });

        html += `
            <div class="calendar-weekly-col">
                <div class="calendar-weekly-header ${isToday ? 'today' : ''}">
                    <span class="day-name">${daysOfWeek[i].substring(0,3)}</span>
                    <span class="day-number">${dayDate.getDate()}</span>
                    <button class="calendar-add-task-btn" style="position:static; margin: 4px auto 0 auto; opacity:1; transform:scale(1);" data-date="${dateKey}" title="Add task">
                        <i data-lucide="plus"></i>
                    </button>
                </div>
                <div class="calendar-weekly-tasks">
                    ${tasksHTML}
                </div>
            </div>
        `;
    }

    html += `</div>`;
    container.innerHTML = html;

    attachCalendarCellListeners(container);
}

function renderDayView(container, titleEl) {
    const d = state.calendarDate;
    titleEl.textContent = d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

    const dateKey = formatDateKey(d);
    const dayTasks = state.tasks.filter(t => t.dueDate === dateKey);
    const completedCount = dayTasks.filter(t => t.completed).length;
    const pendingCount = dayTasks.length - completedCount;

    let tasksHTML = '';
    if (dayTasks.length === 0) {
        tasksHTML = `
            <div class="empty-state" style="display:flex; padding: 40px 0;">
                <p>No tasks scheduled for this day.</p>
                <button class="btn-primary" id="btn-daily-add-task" data-date="${dateKey}">
                    <i data-lucide="plus"></i> Create Task
                </button>
            </div>
        `;
    } else {
        dayTasks.forEach(task => {
            tasksHTML += `
                <div class="recent-task-item" style="padding:16px; margin-bottom:10px;">
                    <div class="recent-task-left">
                        <button class="checkbox-custom-btn" data-toggle-id="${task.id}" title="Toggle Complete">
                            <i data-lucide="check" style="${task.completed ? 'width:14px; height:14px; color:#fff;' : ''}"></i>
                        </button>
                        <div style="display:flex; flex-direction:column; gap:2px; margin-left:8px;">
                            <span class="recent-task-title ${task.completed ? 'completed' : ''}" style="max-width:none; font-weight:600; text-decoration: ${task.completed ? 'line-through' : 'none'}; color: ${task.completed ? 'var(--text-muted)' : 'var(--text-primary)'};">${task.title}</span>
                            <span style="font-size:11px; color:var(--text-muted);">${task.category} &bull; ${task.priority} Priority</span>
                        </div>
                    </div>
                    <div class="recent-task-right">
                        <button class="btn-card-action edit" data-edit-id="${task.id}" title="Edit Task" style="padding:6px;"><i data-lucide="edit-3" style="width:14px; height:14px;"></i></button>
                        <button class="btn-card-action delete" data-delete-id="${task.id}" title="Delete Task" style="padding:6px;"><i data-lucide="trash-2" style="width:14px; height:14px;"></i></button>
                    </div>
                </div>
            `;
        });
    }

    container.innerHTML = `
        <div class="calendar-daily-view">
            <div class="calendar-daily-sidebar glass-panel" style="padding: 24px; display:flex; flex-direction:column; gap:20px; height:fit-content;">
                <h3 style="font-family:var(--font-heading); font-size:18px;">Daily Summary</h3>
                <div class="metrics-grid" style="grid-template-columns: 1fr; gap:12px; margin-bottom:0;">
                    <div class="metric-card glass-panel" style="padding:16px; cursor:default; transform:none; box-shadow:none;">
                        <div class="metric-icon total" style="width:36px; height:36px;"><i data-lucide="clipboard-list" style="width:18px; height:18px;"></i></div>
                        <div class="metric-info">
                            <div class="metric-value" style="font-size:22px;">${dayTasks.length}</div>
                            <div class="metric-label" style="font-size:12px;">Scheduled</div>
                        </div>
                    </div>
                    <div class="metric-card glass-panel" style="padding:16px; cursor:default; transform:none; box-shadow:none;">
                        <div class="metric-icon completed" style="width:36px; height:36px;"><i data-lucide="check-circle2" style="width:18px; height:18px;"></i></div>
                        <div class="metric-info">
                            <div class="metric-value" style="font-size:22px;">${completedCount}</div>
                            <div class="metric-label" style="font-size:12px;">Completed</div>
                        </div>
                    </div>
                </div>
                <button class="btn-primary" id="btn-daily-sidebar-add" data-date="${dateKey}" style="justify-content:center;">
                    <i data-lucide="plus"></i> Add New Task
                </button>
            </div>
            
            <div class="calendar-daily-agenda-card glass-panel">
                <h3>Scheduled Tasks</h3>
                <div class="daily-schedule-list">
                    ${tasksHTML}
                </div>
            </div>
        </div>
    `;

    if (dayTasks.length > 0) {
        container.querySelectorAll('[data-toggle-id]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const taskId = e.currentTarget.getAttribute('data-toggle-id');
                toggleTaskComplete(taskId);
                renderCalendar();
            });
        });

        container.querySelectorAll('[data-edit-id]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const taskId = e.currentTarget.getAttribute('data-edit-id');
                const task = state.tasks.find(t => t.id === taskId);
                openTaskModal(task);
            });
        });

        container.querySelectorAll('[data-delete-id]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const taskId = e.currentTarget.getAttribute('data-delete-id');
                deleteTask(taskId);
                renderCalendar();
            });
        });
    }

    const addBtn = container.querySelector('#btn-daily-add-task') || container.querySelector('#btn-daily-sidebar-add');
    if (addBtn) {
        addBtn.addEventListener('click', () => {
            openTaskModalWithDate(dateKey);
        });
    }
}

function openTaskModalWithDate(dateKey) {
    const dummyTask = {
        dueDate: dateKey,
        title: '',
        desc: '',
        category: 'Work',
        priority: 'Medium',
        tags: [],
        subtasks: []
    };
    openTaskModal(dummyTask);
}

function attachCalendarCellListeners(container) {
    container.querySelectorAll('.calendar-add-task-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const date = e.currentTarget.getAttribute('data-date');
            openTaskModalWithDate(date);
        });
    });

    container.querySelectorAll('.calendar-day-cell').forEach(cell => {
        cell.addEventListener('click', (e) => {
            if (e.target.closest('.calendar-task-pill') || e.target.closest('.calendar-add-task-btn')) return;
            const dateStr = cell.getAttribute('data-date');
            state.calendarDate = new Date(dateStr + 'T00:00:00');
            state.calendarView = 'day';
            renderCalendar();
        });
    });

    container.querySelectorAll('.calendar-task-pill, .calendar-weekly-card').forEach(el => {
        el.addEventListener('click', (e) => {
            e.stopPropagation();
            const taskId = el.getAttribute('data-task-id');
            const task = state.tasks.find(t => t.id === taskId);
            if (task) {
                openTaskModal(task);
            }
        });
    });
}

// ==========================================
// SUPABASE CLIENT LAYER
// ==========================================

function openSupabaseModal() {
    const modal = document.getElementById('supabase-modal');
    document.getElementById('sb-url').value = localStorage.getItem('supabase_url') || '';
    document.getElementById('sb-key').value = localStorage.getItem('supabase_key') || '';
    modal.classList.add('active');
}

function closeSupabaseModal() {
    document.getElementById('supabase-modal').classList.remove('active');
}

async function handleSupabaseConfigSubmit(e) {
    e.preventDefault();
    
    const url = document.getElementById('sb-url').value.trim();
    const key = document.getElementById('sb-key').value.trim();
    
    localStorage.setItem('supabase_url', url);
    localStorage.setItem('supabase_key', key);
    
    closeSupabaseModal();
    showToast('Connecting to Supabase...', 'info');
    
    await initSupabase();
    render();
}

async function disconnectSupabase() {
    localStorage.removeItem('supabase_url');
    localStorage.removeItem('supabase_key');
    
    state.supabase = null;
    state.useSupabase = false;
    
    closeSupabaseModal();
    showToast('Disconnected. Offline Mode active.', 'warning');
    
    await initSupabase();
    render();
}

async function initSupabase() {
    const url = localStorage.getItem('supabase_url') || DEFAULT_SUPABASE_URL;
    const key = localStorage.getItem('supabase_key') || DEFAULT_SUPABASE_KEY;
    
    if (url && key) {
        try {
            updateSyncStatusUI('connection-offline', 'Connecting...');
            
            // Initialize Supabase Client
            state.supabase = supabase.createClient(url, key);
            
            // Check for existing auth session
            const { data: { session } } = await state.supabase.auth.getSession();
            
            if (session) {
                // User is already logged in — hide auth screen
                state.userId = session.user.id;
                document.getElementById('auth-screen').classList.add('hidden');
                
                state.useSupabase = true;
                updateSyncStatusUI('connection-online', 'Sync: Online');
            } else {
                // No session — show login screen and wait
                document.getElementById('auth-screen').classList.remove('hidden');
                updateSyncStatusUI('connection-offline', 'Not signed in');
                // Don't load data yet — wait for login
                return;
            }
        } catch (err) {
            console.error('Supabase initialization failed:', err);
            state.useSupabase = false;
            state.supabase = null;
            updateSyncStatusUI('connection-error', 'Sync Error');
            showToast('Failed to connect to Supabase database.', 'warning');
            // Hide auth screen and fall back to local
            document.getElementById('auth-screen').classList.add('hidden');
        }
    } else {
        state.useSupabase = false;
        state.supabase = null;
        // No Supabase configured — skip auth entirely, use local mode
        document.getElementById('auth-screen').classList.add('hidden');
        updateSyncStatusUI('connection-offline', 'Sync: Local');
    }
    
    await loadTasks();
    await loadDocuments();
}

function updateSyncStatusUI(status, label) {
    const dot = document.getElementById('sync-status-dot');
    const text = document.getElementById('sync-status-text');
    if (!dot || !text) return;
    
    dot.className = `sync-dot ${status}`;
    text.textContent = label;
}

function escapeHTML(str) {
    if (!str) return '';
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// ==========================================
// AUTH HANDLERS
// ==========================================

async function handleLogin(e) {
    e.preventDefault();
    
    const email = document.getElementById('auth-email').value.trim();
    const password = document.getElementById('auth-password').value;
    const errorMsg = document.getElementById('auth-error-msg');
    const btnText = document.getElementById('auth-btn-text');
    
    errorMsg.style.display = 'none';
    btnText.textContent = 'Signing in...';
    
    try {
        const { data, error } = await state.supabase.auth.signInWithPassword({
            email,
            password
        });
        
        if (error) throw error;
        
        state.userId = data.user.id;
        state.useSupabase = true;
        
        document.getElementById('auth-screen').classList.add('hidden');
        updateSyncStatusUI('connection-online', 'Sync: Online');
        
        await loadTasks();
        await loadDocuments();
        render();
        lucide.createIcons();
        showToast('Signed in successfully!', 'success');
    } catch (err) {
        console.error('Login failed:', err);
        errorMsg.textContent = err.message || 'Invalid email or password.';
        errorMsg.style.display = 'block';
    } finally {
        btnText.textContent = 'Sign In';
    }
}

function getUserId() {
    return state.userId || null;
}

// ==========================================
// PERSONAL DOCUMENTS ENGINE LAYER
// ==========================================

const defaultDocuments = [
    {
        id: 'doc-welcome',
        title: 'Welcome to AetherDocs 📝',
        content: `Welcome to your personal writing space inside AetherTask!

Here are some helpful tips to get you started:

1. **Auto-Save**: You don't need to manually save your documents. Just start typing, and our debounced auto-saver will save your drafts in the background. Look at the status indicator in the top-right corner to see when updates are complete!
2. **Offline-First**: Like the task manager, your documents are fully supported locally using your browser's \`localStorage\`.
3. **Cloud Synchronization**: If you connect AetherTask to your Supabase project, your documents will automatically sync across devices so you can write on your phone or desktop.
4. **Clean Design**: We designed a distraction-free glassmorphic environment with dynamic line heights for an immersive and premium writing experience.

Feel free to delete this document or click the "New" button on the left panel to start a fresh draft!`,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
    }
];

async function loadDocuments() {
    if (state.useSupabase && state.supabase) {
        try {
            const { data, error } = await state.supabase
                .from('documents')
                .select('*')
                .order('updated_at', { ascending: false });
            if (error) throw error;
            
            if (data && data.length > 0) {
                state.documents = data;
            } else {
                await seedDefaultDocuments();
            }
        } catch (err) {
            console.error('Failed to load documents from Supabase:', err);
            showToast('Failed to load documents from cloud. Using offline mode.', 'warning');
            loadLocalDocuments();
        }
    } else {
        loadLocalDocuments();
    }
}

function loadLocalDocuments() {
    const local = localStorage.getItem('aetherdocuments');
    if (local) {
        state.documents = JSON.parse(local).sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
    } else {
        state.documents = [...defaultDocuments];
        saveLocalDocuments();
    }
}

function saveLocalDocuments() {
    localStorage.setItem('aetherdocuments', JSON.stringify(state.documents));
}

async function seedDefaultDocuments() {
    state.documents = [...defaultDocuments];
    if (state.useSupabase && state.supabase) {
        try {
            const seeded = defaultDocuments.map(d => ({ ...d, user_id: getUserId() }));
            await state.supabase.from('documents').insert(seeded);
            state.documents = [...seeded];
        } catch (err) {
            console.error('Failed to seed default documents in Supabase:', err);
        }
    } else {
        saveLocalDocuments();
    }
}

function renderDocuments() {
    const listContainer = document.getElementById('docs-list-container');
    const editorContainer = document.getElementById('docs-editor-container');
    const panelContainer = document.querySelector('.documents-container');
    
    if (!listContainer || !editorContainer) return;
    
    // 1. Render Left Sidebar List
    let listHTML = '';
    if (state.documents.length === 0) {
        listHTML = `<div class="empty-state" style="padding:20px; font-size:12px; text-align:center;"><p>No documents found.</p></div>`;
    } else {
        state.documents.forEach(doc => {
            const isActive = doc.id === state.activeDocumentId;
            const updatedDate = new Date(doc.updated_at).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric'
            });
            const preview = doc.content ? doc.content.substring(0, 45).replace(/[#*`]/g, '') + (doc.content.length > 45 ? '...' : '') : 'Empty document';
            
            listHTML += `
                <div class="doc-list-item ${isActive ? 'active' : ''}" data-doc-id="${doc.id}">
                    <div class="doc-item-title">${escapeHTML(doc.title || 'Untitled Document')}</div>
                    <div class="doc-item-meta">
                        <span style="font-size:10px; color:var(--text-muted);">${preview}</span>
                        <span>${updatedDate}</span>
                    </div>
                </div>
            `;
        });
    }
    listContainer.innerHTML = listHTML;
    
    // Attach click listeners to doc list items
    listContainer.querySelectorAll('.doc-list-item').forEach(item => {
        item.addEventListener('click', () => {
            const docId = item.getAttribute('data-doc-id');
            selectDocument(docId);
        });
    });
    
    // 2. Render Right Side Editor Pane
    const activeDoc = state.documents.find(d => d.id === state.activeDocumentId);
    if (!activeDoc) {
        // Render Empty State
        editorContainer.innerHTML = `
            <div class="docs-empty-state">
                <i data-lucide="file-text" style="width: 48px; height: 48px; color: var(--text-muted); margin-bottom: 16px;"></i>
                <p>Select a document or create a new one to start writing.</p>
                <button class="btn-primary" id="btn-create-doc-empty" style="gap:4px;">
                    <i data-lucide="plus" style="width:14px; height:14px;"></i> New Document
                </button>
            </div>
        `;
        
        // Mobile layout sync: ensure list is shown if no document selected
        panelContainer.classList.remove('show-editor');
        
        const emptyCreateBtn = document.getElementById('btn-create-doc-empty');
        if (emptyCreateBtn) {
            emptyCreateBtn.addEventListener('click', createDocument);
        }
    } else {
        // Render Active Editor Workspace
        editorContainer.innerHTML = `
            <div class="docs-editor-workspace">
                <div class="docs-editor-header">
                    <div class="docs-header-left">
                        <button class="btn-doc-back" id="btn-doc-close-editor" title="Back to list">
                            <i data-lucide="chevron-left" style="width: 18px; height: 18px;"></i>
                        </button>
                        <input type="text" class="doc-title-input" id="doc-active-title" value="${escapeHTML(activeDoc.title)}" placeholder="Untitled Document" autocomplete="off">
                    </div>
                    <div class="docs-header-right">
                        <div class="autosave-status saved" id="doc-save-status">
                            <span class="autosave-status-dot"></span>
                            <span id="doc-save-status-text">Saved</span>
                        </div>
                        <button class="btn-card-action delete" id="btn-delete-active-doc" title="Delete Document" style="padding: 8px;">
                            <i data-lucide="trash-2" style="width:16px; height:16px;"></i>
                        </button>
                    </div>
                </div>
                <textarea class="doc-textarea" id="doc-active-textarea" placeholder="Start writing here...">${activeDoc.content || ''}</textarea>
            </div>
        `;
        
        // Mobile layout sync: slide editor in
        panelContainer.classList.add('show-editor');
        
        // Attach Editor Listeners
        const titleInput = document.getElementById('doc-active-title');
        const textarea = document.getElementById('doc-active-textarea');
        const deleteBtn = document.getElementById('btn-delete-active-doc');
        const backBtn = document.getElementById('btn-doc-close-editor');
        
        titleInput.addEventListener('input', triggerAutosave);
        textarea.addEventListener('input', triggerAutosave);
        
        deleteBtn.addEventListener('click', () => deleteDocument(activeDoc.id));
        
        if (backBtn) {
            backBtn.addEventListener('click', () => {
                state.activeDocumentId = null;
                renderDocuments();
            });
        }
    }
    
    lucide.createIcons();
}

function selectDocument(id) {
    state.activeDocumentId = id;
    renderDocuments();
    
    // Focus textarea if on desktop
    const textarea = document.getElementById('doc-active-textarea');
    if (textarea && window.innerWidth > 768) {
        textarea.focus();
    }
}

async function createDocument() {
    const newDoc = {
        id: `doc-${Date.now()}`,
        title: 'Untitled Document',
        content: '',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        user_id: getUserId()
    };
    
    // Add to state
    state.documents.unshift(newDoc);
    state.activeDocumentId = newDoc.id;
    
    // Save to persistence
    if (state.useSupabase && state.supabase) {
        try {
            const { error } = await state.supabase.from('documents').insert([newDoc]);
            if (error) throw error;
        } catch (err) {
            console.error('Supabase doc insert failed:', err);
            showToast('Saved locally. Server sync failed.', 'warning');
        }
    } else {
        saveLocalDocuments();
    }
    
    renderDocuments();
    
    // Focus title input for immediate editing
    const titleInput = document.getElementById('doc-active-title');
    if (titleInput) {
        titleInput.focus();
        titleInput.select();
    }
    showToast('New document created!', 'success');
}

async function deleteDocument(id) {
    if (!confirm('Are you sure you want to delete this document?')) return;
    
    const index = state.documents.findIndex(d => d.id === id);
    if (index !== -1) {
        state.documents.splice(index, 1);
        
        if (state.activeDocumentId === id) {
            state.activeDocumentId = null;
        }
        
        if (state.useSupabase && state.supabase) {
            try {
                const { error } = await state.supabase.from('documents').delete().eq('id', id);
                if (error) throw error;
            } catch (err) {
                console.error('Supabase doc delete failed:', err);
                showToast('Failed to delete document from server.', 'warning');
            }
        } else {
            saveLocalDocuments();
        }
        
        renderDocuments();
        showToast('Document deleted.', 'warning');
    }
}

function triggerAutosave() {
    const statusText = document.getElementById('doc-save-status-text');
    const statusDot = document.getElementById('doc-save-status');
    
    if (statusText && statusDot) {
        statusDot.className = 'autosave-status saving';
        statusText.textContent = 'Saving...';
    }
    
    // Clear existing timer
    if (state.docAutosaveTimer) {
        clearTimeout(state.docAutosaveTimer);
    }
    
    // Set 600ms debounce timer to save
    state.docAutosaveTimer = setTimeout(async () => {
        await saveActiveDocument();
    }, 600);
}

async function saveActiveDocument() {
    if (!state.activeDocumentId) return;
    
    const titleVal = document.getElementById('doc-active-title').value.trim();
    const contentVal = document.getElementById('doc-active-textarea').value;
    
    const doc = state.documents.find(d => d.id === state.activeDocumentId);
    if (doc) {
        doc.title = titleVal || 'Untitled Document';
        doc.content = contentVal;
        doc.updated_at = new Date().toISOString();
        
        // Sort documents list by updated_at (active floats to top)
        state.documents.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
        
        // Save
        if (state.useSupabase && state.supabase) {
            try {
                const { error } = await state.supabase
                    .from('documents')
                    .update({ 
                        title: doc.title, 
                        content: doc.content, 
                        updated_at: doc.updated_at 
                    })
                    .eq('id', doc.id);
                if (error) throw error;
            } catch (err) {
                console.error('Supabase autosave error:', err);
            }
        } else {
            saveLocalDocuments();
        }
        
        // Update UI status to Saved
        const statusText = document.getElementById('doc-save-status-text');
        const statusDot = document.getElementById('doc-save-status');
        if (statusText && statusDot) {
            statusDot.className = 'autosave-status saved';
            statusText.textContent = 'Saved';
        }
        
        // Re-render sidebar list to show updated title and dates (without rebuilding editor container)
        const listContainer = document.getElementById('docs-list-container');
        if (listContainer) {
            let listHTML = '';
            state.documents.forEach(d => {
                const isActive = d.id === state.activeDocumentId;
                const updatedDate = new Date(d.updated_at).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric'
                });
                const preview = d.content ? d.content.substring(0, 45).replace(/[#*`]/g, '') + (d.content.length > 45 ? '...' : '') : 'Empty document';
                
                listHTML += `
                    <div class="doc-list-item ${isActive ? 'active' : ''}" data-doc-id="${d.id}">
                        <div class="doc-item-title">${escapeHTML(d.title || 'Untitled Document')}</div>
                        <div class="doc-item-meta">
                            <span style="font-size:10px; color:var(--text-muted);">${preview}</span>
                            <span>${updatedDate}</span>
                        </div>
                    </div>
                `;
            });
            listContainer.innerHTML = listHTML;
            
            // Re-attach list clickers
            listContainer.querySelectorAll('.doc-list-item').forEach(item => {
                item.addEventListener('click', () => {
                    const docId = item.getAttribute('data-doc-id');
                    selectDocument(docId);
                });
            });
        }
    }
}
