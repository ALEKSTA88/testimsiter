import { 
    getSnippets, 
    getStats, 
    checkAuth,
    getCurrentUser,
    signOut,
    searchSnippets 
} from './supabase.js';

document.addEventListener('DOMContentLoaded', async () => {
    // Инициализация
    await initApp();
    
    // Загрузка данных
    loadRecentSnippets();
    loadStats();
    loadTrending();
    
    // Настройка поиска
    setupSearch();
});

// Инициализация приложения
async function initApp() {
    // Проверить авторизацию
    const session = await checkAuth();
    const authSection = document.getElementById('authSection');
    
    if (!authSection) return;
    
    if (session) {
        // Пользователь авторизован
        const user = await getCurrentUser();
        
        authSection.innerHTML = `
            <div class="user-menu">
                <a href="dashboard.html" class="user-avatar">
                    <i class="fas fa-user"></i>
                    <span>${user.user_metadata?.username || 'Профиль'}</span>
                </a>
                <button id="logoutBtn" class="btn btn-secondary btn-small">
                    <i class="fas fa-sign-out-alt"></i>
                </button>
            </div>
        `;
        
        // Выход
        document.getElementById('logoutBtn').addEventListener('click', async () => {
            try {
                await signOut();
                window.location.reload();
            } catch (error) {
                console.error('Ошибка выхода:', error);
            }
        });
    } else {
        // Пользователь не авторизован
        authSection.innerHTML = `
            <a href="auth.html" class="btn btn-secondary">Вход</a>
            <a href="auth.html?tab=signup" class="btn btn-primary">Регистрация</a>
        `;
    }
}

// Загрузка недавних скриптов
async function loadRecentSnippets() {
    const container = document.getElementById('recentPosts');
    if (!container) return;
    
    try {
        container.innerHTML = '<div class="loading">Загрузка...</div>';
        
        const snippets = await getSnippets(10);
        
        if (snippets.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-code-branch"></i>
                    <h3>Пока нет скриптов</h3>
                    <p>Будьте первым, кто опубликует код!</p>
                    <a href="create.html" class="btn btn-primary">Создать скрипт</a>
                </div>
            `;
            return;
        }
        
        container.innerHTML = snippets.map(snippet => `
            <a href="view.html?id=${snippet.id}" class="snippet-card">
                <div class="snippet-header">
                    <h3>${escapeHtml(snippet.title)}</h3>
                    <span class="language-badge">${snippet.language}</span>
                </div>
                
                <div class="snippet-meta">
                    <span><i class="fas fa-user"></i> ${snippet.user?.username || 'Аноним'}</span>
                    <span><i class="fas fa-clock"></i> ${formatDate(snippet.created_at)}</span>
                    <span><i class="fas fa-eye"></i> ${snippet.views}</span>
                </div>
                
                <div class="snippet-excerpt">${truncateCode(snippet.code, 200)}</div>
                
                ${snippet.tags && snippet.tags.length > 0 ? `
                    <div class="snippet-tags">
                        ${snippet.tags.slice(0, 3).map(tag => `
                            <span class="tag">${tag}</span>
                        `).join('')}
                    </div>
                ` : ''}
            </a>
        `).join('');
        
    } catch (error) {
        console.error('Ошибка загрузки скриптов:', error);
        container.innerHTML = `
            <div class="error-state">
                <i class="fas fa-exclamation-triangle"></i>
                <h3>Ошибка загрузки</h3>
                <p>${error.message}</p>
            </div>
        `;
    }
}

// Загрузка статистики
async function loadStats() {
    try {
        const stats = await getStats();
        
        const totalSnippets = document.getElementById('totalSnippets');
        const totalUsers = document.getElementById('totalUsers');
        
        if (totalSnippets) {
            totalSnippets.textContent = stats.snippets.toLocaleString();
        }
        
        if (totalUsers) {
            totalUsers.textContent = stats.users.toLocaleString();
        }
    } catch (error) {
        console.error('Ошибка загрузки статистики:', error);
    }
}

// Загрузка популярного
async function loadTrending() {
    const container = document.getElementById('trendingList');
    if (!container) return;
    
    try {
        const { data: snippets } = await supabase
            .from('snippets')
            .select('id, title, language, views')
            .eq('visibility', 'public')
            .order('views', { ascending: false })
            .limit(5);
        
        if (snippets && snippets.length > 0) {
            container.innerHTML = snippets.map(snippet => `
                <a href="view.html?id=${snippet.id}" class="trending-item">
                    <span class="trending-title">${truncateText(snippet.title, 30)}</span>
                    <div class="trending-meta">
                        <span class="language-badge small">${snippet.language}</span>
                        <span class="views">${snippet.views} 👁️</span>
                    </div>
                </a>
            `).join('');
        } else {
            container.innerHTML = '<p class="empty-text">Пока нет данных</p>';
        }
    } catch (error) {
        console.error('Ошибка загрузки трендов:', error);
        container.innerHTML = '<p class="error-text">Ошибка загрузки</p>';
    }
}

// Настройка поиска
function setupSearch() {
    const searchInput = document.querySelector('input[type="search"]');
    if (!searchInput) return;
    
    let searchTimeout;
    
    searchInput.addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        
        searchTimeout = setTimeout(async () => {
            const query = e.target.value.trim();
            
            if (query.length < 2) {
                // Показать недавние если поиск пустой
                loadRecentSnippets();
                return;
            }
            
            await performSearch(query);
        }, 500);
    });
}

// Выполнение поиска
async function performSearch(query) {
    const container = document.getElementById('recentPosts');
    if (!container) return;
    
    try {
        container.innerHTML = '<div class="loading">Поиск...</div>';
        
        const snippets = await searchSnippets(query);
        
        if (snippets.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-search"></i>
                    <h3>Ничего не найдено</h3>
                    <p>Попробуйте другие ключевые слова</p>
                </div>
            `;
            return;
        }
        
        container.innerHTML = snippets.map(snippet => `
            <a href="view.html?id=${snippet.id}" class="snippet-card">
                <div class="snippet-header">
                    <h3>${highlightText(snippet.title, query)}</h3>
                    <span class="language-badge">${snippet.language}</span>
                </div>
                
                <div class="snippet-meta">
                    <span><i class="fas fa-user"></i> ${snippet.user?.username || 'Аноним'}</span>
                    <span><i class="fas fa-clock"></i> ${formatDate(snippet.created_at)}</span>
                </div>
                
                <div class="snippet-excerpt">${highlightText(truncateCode(snippet.code, 200), query)}</div>
            </a>
        `).join('');
        
    } catch (error) {
        console.error('Ошибка поиска:', error);
        container.innerHTML = `
            <div class="error-state">
                <i class="fas fa-exclamation-triangle"></i>
                <h3>Ошибка поиска</h3>
                <p>${error.message}</p>
            </div>
        `;
    }
}

// Вспомогательные функции
function formatDate(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 60) {
        return `${diffMins} мин назад`;
    } else if (diffHours < 24) {
        return `${diffHours} ч назад`;
    } else if (diffDays < 7) {
        return `${diffDays} дн назад`;
    } else {
        return date.toLocaleDateString('ru-RU');
    }
}

function truncateText(text, maxLength) {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
}

function truncateCode(code, maxLength) {
    // Удаляем лишние пробелы и переносы для предпросмотра
    const cleanCode = code.replace(/\s+/g, ' ').trim();
    return truncateText(cleanCode, maxLength);
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function highlightText(text, query) {
    if (!query) return escapeHtml(text);
    
    const escapedText = escapeHtml(text);
    const escapedQuery = escapeHtml(query);
    const regex = new RegExp(`(${escapedQuery})`, 'gi');
    
    return escapedText.replace(regex, '<mark>$1</mark>');
}

// Добавляем стили для пустых состояний и трендов
const style = document.createElement('style');
style.textContent = `
    .user-menu {
        display: flex;
        align-items: center;
        gap: 10px;
    }
    
    .user-avatar {
        display: flex;
        align-items: center;
        gap: 8px;
        color: var(--text-color);
        text-decoration: none;
        padding: 8px 15px;
        border-radius: 20px;
        background-color: rgba(255, 255, 255, 0.1);
        transition: var(--transition);
    }
    
    .user-avatar:hover {
        background-color: rgba(255, 255, 255, 0.2);
    }
    
    .empty-state, .error-state {
        text-align: center;
        padding: 40px 20px;
        color: var(--text-secondary);
    }
    
    .empty-state i, .error-state i {
        font-size: 3rem;
        margin-bottom: 20px;
        color: var(--primary-color);
    }
    
    .empty-state h3, .error-state h3 {
        margin-bottom: 10px;
        color: var(--text-color);
    }
    
    .trending-item {
        display: block;
        padding: 12px 15px;
        border-bottom: 1px solid var(--border-color);
        text-decoration: none;
        color: var(--text-color);
        transition: var(--transition);
    }
    
    .trending-item:last-child {
        border-bottom: none;
    }
    
    .trending-item:hover {
        background-color: rgba(255, 255, 255, 0.05);
    }
    
    .trending-title {
        display: block;
        margin-bottom: 5px;
        font-weight: 500;
    }
    
    .trending-meta {
        display: flex;
        justify-content: space-between;
        align-items: center;
    }
    
    .language-badge.small {
        font-size: 11px;
        padding: 2px 8px;
    }
    
    .views {
        font-size: 12px;
        color: var(--text-secondary);
    }
    
    .empty-text, .error-text {
        text-align: center;
        padding: 20px;
        color: var(--text-secondary);
    }
    
    mark {
        background-color: rgba(251, 191, 36, 0.3);
        color: inherit;
        padding: 0 2px;
        border-radius: 2px;
    }
    
    .snippet-tags {
        display: flex;
        gap: 8px;
        margin-top: 10px;
        flex-wrap: wrap;
    }
    
    .tag {
        background-color: rgba(37, 99, 235, 0.1);
        color: var(--primary-color);
        padding: 4px 10px;
        border-radius: 15px;
        font-size: 12px;
        font-weight: 500;
    }
`;
document.head.appendChild(style);