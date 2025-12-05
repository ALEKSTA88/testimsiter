import { signUp, signIn, supabase, checkAuth } from './supabase.js';

document.addEventListener('DOMContentLoaded', async () => {
    // Проверить, авторизован ли пользователь
    const session = await checkAuth();
    if (session) {
        // Перенаправить на главную если уже авторизован
        const redirect = getUrlParameter('redirect') || 'index.html';
        window.location.href = redirect;
        return;
    }
    
    // Элементы DOM
    const loginTab = document.querySelector('[data-tab="login"]');
    const signupTab = document.querySelector('[data-tab="signup"]');
    const loginForm = document.getElementById('loginForm');
    const signupForm = document.getElementById('signupForm');
    const errorMessage = document.getElementById('errorMessage');
    const successMessage = document.getElementById('successMessage');
    const forgotPasswordLink = document.getElementById('forgotPassword');
    const githubBtn = document.getElementById('githubSignIn');
    const googleBtn = document.getElementById('googleSignIn');
    
    // Переключение между вкладками
    loginTab.addEventListener('click', () => {
        loginTab.classList.add('active');
        signupTab.classList.remove('active');
        loginForm.classList.add('active');
        signupForm.classList.remove('active');
        hideMessages();
    });
    
    signupTab.addEventListener('click', () => {
        signupTab.classList.add('active');
        loginTab.classList.remove('active');
        signupForm.classList.add('active');
        loginForm.classList.remove('active');
        hideMessages();
    });
    
    // Вход
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const email = document.getElementById('loginEmail').value;
        const password = document.getElementById('loginPassword').value;
        const loginBtn = loginForm.querySelector('button[type="submit"]');
        
        try {
            // Показать индикатор загрузки
            const originalText = loginBtn.innerHTML;
            loginBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Вход...';
            loginBtn.disabled = true;
            
            // Выполнить вход
            const { user, session } = await signIn(email, password);
            
            // Показать успешное сообщение
            showSuccess('Вход выполнен успешно!');
            
            // Перенаправить через 1 секунду
            setTimeout(() => {
                const redirect = getUrlParameter('redirect') || 'index.html';
                window.location.href = redirect;
            }, 1000);
            
        } catch (error) {
            console.error('Ошибка входа:', error);
            showError(getErrorMessage(error));
            
            // Восстановить кнопку
            loginBtn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Войти';
            loginBtn.disabled = false;
        }
    });
    
    // Регистрация
    signupForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const username = document.getElementById('signupUsername').value;
        const email = document.getElementById('signupEmail').value;
        const password = document.getElementById('signupPassword').value;
        const confirmPassword = document.getElementById('confirmPassword').value;
        
        // Проверка паролей
        if (password !== confirmPassword) {
            showError('Пароли не совпадают');
            return;
        }
        
        // Проверка сложности пароля
        if (password.length < 6) {
            showError('Пароль должен содержать минимум 6 символов');
            return;
        }
        
        const signupBtn = signupForm.querySelector('button[type="submit"]');
        
        try {
            // Показать индикатор загрузки
            const originalText = signupBtn.innerHTML;
            signupBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Регистрация...';
            signupBtn.disabled = true;
            
            // Проверить, существует ли пользователь с таким username
            const { data: existingUser } = await supabase
                .from('users')
                .select('id')
                .eq('username', username)
                .single();
            
            if (existingUser) {
                throw new Error('Пользователь с таким именем уже существует');
            }
            
            // Зарегистрировать пользователя
            const { user, session } = await signUp(email, password, username);
            
            // Создать запись в таблице users
            const { error: profileError } = await supabase
                .from('users')
                .insert([
                    {
                        id: user.id,
                        username: username,
                        created_at: new Date().toISOString()
                    }
                ]);
            
            if (profileError) {
                console.error('Ошибка создания профиля:', profileError);
                // Удалить пользователя auth если не удалось создать профиль
                await supabase.auth.admin.deleteUser(user.id);
                throw new Error('Ошибка создания профиля пользователя');
            }
            
            // Показать успешное сообщение
            showSuccess('Регистрация успешна! Проверьте email для подтверждения.');
            
            // Автоматически войти
            setTimeout(async () => {
                const { data } = await signIn(email, password);
                const redirect = getUrlParameter('redirect') || 'index.html';
                window.location.href = redirect;
            }, 2000);
            
        } catch (error) {
            console.error('Ошибка регистрации:', error);
            showError(getErrorMessage(error));
            
            // Восстановить кнопку
            signupBtn.innerHTML = '<i class="fas fa-user-plus"></i> Зарегистрироваться';
            signupBtn.disabled = false;
        }
    });
    
    // Восстановление пароля
    forgotPasswordLink.addEventListener('click', async (e) => {
        e.preventDefault();
        
        const email = prompt('Введите ваш email для восстановления пароля:');
        if (!email) return;
        
        try {
            const { error } = await supabase.auth.resetPasswordForEmail(email, {
                redirectTo: `${window.location.origin}/reset-password.html`,
            });
            
            if (error) throw error;
            
            showSuccess('Инструкции по восстановлению пароля отправлены на email');
        } catch (error) {
            showError('Ошибка при восстановлении пароля');
        }
    });
    
    // OAuth авторизация
    githubBtn.addEventListener('click', async () => {
        try {
            const { error } = await supabase.auth.signInWithOAuth({
                provider: 'github',
                options: {
                    redirectTo: `${window.location.origin}/auth-callback.html`
                }
            });
            
            if (error) throw error;
        } catch (error) {
            showError('Ошибка авторизации через GitHub');
        }
    });
    
    googleBtn.addEventListener('click', async () => {
        try {
            const { error } = await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    redirectTo: `${window.location.origin}/auth-callback.html`,
                    queryParams: {
                        access_type: 'offline',
                        prompt: 'consent'
                    }
                }
            });
            
            if (error) throw error;
        } catch (error) {
            showError('Ошибка авторизации через Google');
        }
    });
    
    // Вспомогательные функции
    function showError(message) {
        errorMessage.textContent = message;
        errorMessage.style.display = 'block';
        successMessage.style.display = 'none';
        
        // Автоскрытие через 5 секунд
        setTimeout(() => {
            errorMessage.style.display = 'none';
        }, 5000);
    }
    
    function showSuccess(message) {
        successMessage.textContent = message;
        successMessage.style.display = 'block';
        errorMessage.style.display = 'none';
    }
    
    function hideMessages() {
        errorMessage.style.display = 'none';
        successMessage.style.display = 'none';
    }
    
    function getErrorMessage(error) {
        const messages = {
            'Invalid login credentials': 'Неверный email или пароль',
            'Email not confirmed': 'Подтвердите email для входа',
            'User already registered': 'Пользователь уже зарегистрирован',
            'Password should be at least 6 characters': 'Пароль должен быть не менее 6 символов'
        };
        
        return messages[error.message] || error.message || 'Произошла ошибка';
    }
    
    function getUrlParameter(name) {
        name = name.replace(/[\[\]]/g, '\\$&');
        const regex = new RegExp('[?&]' + name + '(=([^&#]*)|&|#|$)');
        const results = regex.exec(window.location.search);
        if (!results) return null;
        if (!results[2]) return '';
        return decodeURIComponent(results[2].replace(/\+/g, ' '));
    }
});