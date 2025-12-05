import { createSnippet, getCurrentUser, checkAuth } from './supabase.js';

document.addEventListener('DOMContentLoaded', async () => {
    // Проверка авторизации
    const session = await checkAuth();
    if (!session) {
        window.location.href = 'auth.html?redirect=create.html';
        return;
    }
    
    const form = document.getElementById('createSnippetForm');
    const codeEditor = document.getElementById('codeEditor');
    const codeTextarea = document.getElementById('code');
    const previewBtn = document.getElementById('previewBtn');
    const previewSection = document.getElementById('previewSection');
    const previewContent = document.getElementById('previewContent');
    const clearBtn = document.getElementById('clearCode');
    const formatBtn = document.getElementById('formatCode');
    
    // Синхронизация редактора кода с textarea
    codeEditor.addEventListener('input', () => {
        codeTextarea.value = codeEditor.textContent;
    });
    
    // Очистка кода
    clearBtn.addEventListener('click', () => {
        codeEditor.textContent = '';
        codeTextarea.value = '';
    });
    
    // Форматирование кода
    formatBtn.addEventListener('click', () => {
        const code = codeTextarea.value;
        // Простое форматирование (можно подключить prettier или аналоги)
        const formatted = code
            .replace(/\t/g, '  ')
            .replace(/\n\s*\n\s*\n/g, '\n\n');
        codeTextarea.value = formatted;
        codeEditor.textContent = formatted;
    });
    
    // Предпросмотр
    previewBtn.addEventListener('click', async () => {
        const title = document.getElementById('title').value;
        const description = document.getElementById('description').value;
        const language = document.getElementById('language').value;
        const code = codeTextarea.value;
        
        if (!title || !code || !language) {
            alert('Заполните обязательные поля: заголовок, код и язык');
            return;
        }
        
        previewContent.innerHTML = `
            <div class="snippet-preview">
                <h3>${title}</h3>
                ${description ? `<p>${description}</p>` : ''}
                <div class="code-preview">
                    <div class="code-header">
                        <span class="language-badge">${language}</span>
                    </div>
                    <pre><code class="language-${language}">${escapeHtml(code)}</code></pre>
                </div>
            </div>
        `;
        
        previewSection.style.display = 'block';
        hljs.highlightAll();
        
        // Прокрутка к предпросмотру
        previewSection.scrollIntoView({ behavior: 'smooth' });
    });
    
    // Отправка формы
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const user = await getCurrentUser();
        if (!user) {
            alert('Пожалуйста, войдите в систему');
            window.location.href = 'auth.html';
            return;
        }
        
        const publishBtn = document.getElementById('publishBtn');
        const originalText = publishBtn.innerHTML;
        
        try {
            // Показать индикатор загрузки
            publishBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Публикация...';
            publishBtn.disabled = true;
            
            // Собрать данные
            const snippetData = {
                title: document.getElementById('title').value,
                description: document.getElementById('description').value,
                code: codeTextarea.value,
                language: document.getElementById('language').value,
                visibility: document.getElementById('visibility').value,
                tags: document.getElementById('tags').value
                    .split(',')
                    .map(tag => tag.trim())
                    .filter(tag => tag)
                    .slice(0, 5)
            };
            
            // Проверка обязательных полей
            if (!snippetData.title || !snippetData.code || !snippetData.language) {
                throw new Error('Заполните обязательные поля: заголовок, код и язык');
            }
            
            // Создать скрипт
            const snippet = await createSnippet(snippetData);
            
            // Показать успешное сообщение
            publishBtn.innerHTML = '<i class="fas fa-check"></i> Опубликовано!';
            publishBtn.style.backgroundColor = '#10b981';
            
            // Перенаправить на страницу скрипта через 1.5 секунды
            setTimeout(() => {
                window.location.href = `view.html?id=${snippet.id}`;
            }, 1500);
            
        } catch (error) {
            console.error('Ошибка при публикации:', error);
            alert(`Ошибка: ${error.message}`);
            
            // Восстановить кнопку
            publishBtn.innerHTML = originalText;
            publishBtn.disabled = false;
        }
    });
});

// Вспомогательная функция для экранирования HTML
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}