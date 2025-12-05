import { getSnippetById, getCurrentUser, supabase } from './supabase.js';

document.addEventListener('DOMContentLoaded', async () => {
    const snippetContainer = document.getElementById('snippetContainer');
    const notFound = document.getElementById('notFound');
    const currentUrl = document.getElementById('currentUrl');
    
    // Получить ID из URL
    const urlParams = new URLSearchParams(window.location.search);
    const snippetId = urlParams.get('id');
    
    if (!snippetId) {
        showNotFound();
        return;
    }
    
    try {
        // Загрузить скрипт
        const snippet = await getSnippetById(snippetId);
        
        // Отобразить скрипт
        displaySnippet(snippet);
        
        // Показать текущий URL
        if (currentUrl) {
            currentUrl.textContent = window.location.href;
        }
        
    } catch (error) {
        console.error('Ошибка загрузки скрипта:', error);
        showNotFound();
    }
});

// Отображение скрипта
async function displaySnippet(snippet) {
    const container = document.getElementById('snippetContainer');
    const user = await getCurrentUser();
    
    // Проверка доступа для приватных скриптов
    if (snippet.visibility === 'private' && (!user || user.id !== snippet.user_id)) {
        showNotFound();
        return;
    }
    
    container.innerHTML = `
        <div class="snippet-header">
            <h1 class="snippet-title">${escapeHtml(snippet.title)}</h1>
            
            <div class="snippet-meta">
                <div class="snippet-author">
                    <div class="author-avatar">
                        ${snippet.user?.username?.charAt(0).toUpperCase() || 'A'}
                    </div>
                    <div>
                        <div class="author-name">${snippet.user?.username || 'Аноним'}</div>
                        <div class="post-date">${formatDate(snippet.created_at)}</div>
                    </div>
                </div>
                
                <div class="meta-item">
                    <i class="fas fa-eye"></i> ${snippet.views} просмотров
                </div>
                
                <div class="meta-item">
                    <i class="fas fa-code"></i> ${snippet.language}
                </div>
                
                ${snippet.visibility === 'private' ? `
                    <div class="meta-item">
                        <i class="fas fa-lock"></i> Приватный
                    </div>
                ` : ''}
            </div>
            
            ${snippet.tags && snippet.tags.length > 0 ? `
                <div class="tags-container">
                    ${snippet.tags.map(tag => `
                        <span class="tag">${tag}</span>
                    `).join('')}
                </div>
            ` : ''}
            
            <div class="snippet-actions">
                <button id="copyBtn" class="copy-btn">
                    <i class="far fa-copy"></i> Копировать код
                </button>
                
                ${user && user.id === snippet.user_id ? `
                    <a href="edit.html?id=${snippet.id}" class="btn btn-secondary">
                        <i class="fas fa-edit"></i> Редактировать
                    </a>
                    <button id="deleteBtn" class="btn btn-secondary">
                        <i class="fas fa-trash"></i> Удалить
                    </button>
                ` : ''}
                
                <div class="share-buttons">
                    <button class="share-btn" data-share="twitter" title="Поделиться в Twitter">
                        <i class="fab fa-twitter"></i>
                    </button>
                    <button class="share-btn" data-share="telegram" title="Поделиться в Telegram">
                        <i class="fab fa-telegram"></i>
                    </button>
                    <button class="share-btn" data-share="copy-link" title="Копировать ссылку">
                        <i class="fas fa-link"></i>
                    </button>
                </div>
            </div>
        </div>
        
        ${snippet.description ? `
            <div class="description">
                <h3>Описание</h3>
                <p>${escapeHtml(snippet.description)}</p>
            </div>
        ` : ''}
        
        <div class="code-container">
            <div class="code-toolbar">
                <div class="language-display">
                    <i class="fas fa-code"></i>
                    <span>${snippet.language}</span>
                </div>
                <a href="raw.html?id=${snippet.id}" class="raw-link" target="_blank">
                    <i class="fas fa-external-link-alt"></i> Сырой код
                </a>
            </div>
            
            <pre><code id="codeContent" class="language-${snippet.language}">${escapeHtml(snippet.code)}</code></pre>
        </div>
    `;
    
    // Подсветка синтаксиса
    hljs.highlightAll();
    
    // Настройка кнопок
    setupButtons(snippet);
    
    // Отслеживание просмотров (уже увеличено в getSnippetById)
}

// Настройка кнопок
function setupButtons(snippet) {
    // Копирование кода
    const copyBtn = document.getElementById('copyBtn');
    if (copyBtn) {
        copyBtn.addEventListener('click', () => {
            const code = document.getElementById('codeContent').textContent;
            navigator.clipboard.writeText(code)
                .then(() => {
                    copyBtn.innerHTML = '<i class="fas fa-check"></i> Скопировано!';
                    copyBtn.classList.add('copied');
                    
                    setTimeout(() => {
                        copyBtn.innerHTML = '<i class="far fa-copy"></i> Копировать код';
                        copyBtn.classList.remove('copied');
                    }, 2000);
                })
                .catch(err => {
                    console.error('Ошибка копирования:', err);
                    alert('Не удалось скопировать код');
                });
        });
    }
    
    // Удаление
    const deleteBtn = document.getElementById('deleteBtn');
    if (deleteBtn) {
        deleteBtn.addEventListener('click', async () => {
            if (!confirm('Вы уверены, что хотите удалить этот скрипт? Это действие нельзя отменить.')) {
                return;
            }
            
            try {
                const { error } = await supabase
                    .from('snippets')
                    .delete()
                    .eq('id', snippet.id);
                
                if (error) throw error;
                
                alert('Скрипт успешно удален');
                window.location.href = 'index.html';
            } catch (error) {
                console.error('Ошибка удаления:', error);
                alert('Ошибка при удалении скрипта');
            }
        });
    }
    
    // Поделиться
    document.querySelectorAll('.share-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const type = btn.dataset.share;
            const url = window.location.href;
            const title = snippet.title;
            
            switch (type) {
                case 'twitter':
                    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(title)}&url=${encodeURIComponent(url)}`, '_blank');
                    break;
                    
                case 'telegram':
                    window.open(`https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}`, '_blank');
                    break;
                    
                case 'copy-link':
                    navigator.clipboard.writeText(url)
                        .then(() => {
                            const original = btn.innerHTML;
                            btn.innerHTML = '<i class="fas fa-check"></i>';
                            setTimeout(() => btn.innerHTML = original, 2000);
                        });
                    break;
            }
        });
    });
}

// Показать "не найдено"
function showNotFound() {
    document.getElementById('snippetContainer').style.display = 'none';
    document.getElementById('notFound').style.display = 'block';
}

// Вспомогательные функции
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('ru-RU', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}