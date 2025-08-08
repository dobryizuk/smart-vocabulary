const js = require('@eslint/js');
const unusedImports = require('eslint-plugin-unused-imports');

module.exports = [
  js.configs.recommended,
  {
    ignores: [
      'node_modules/**/*',
      'dist/**/*',
      'build/**/*',
      '*.min.js',
      'sw.js',
      'manifest.json'
    ]
  },
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        // Browser globals
        window: 'readonly',
        document: 'readonly',
        console: 'readonly',
        localStorage: 'readonly',
        sessionStorage: 'readonly',
        fetch: 'readonly',
        navigator: 'readonly',
        URL: 'readonly',
        alert: 'readonly',
        confirm: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        Blob: 'readonly',
        location: 'readonly',
        getComputedStyle: 'readonly',
        SpeechSynthesisUtterance: 'readonly',
        
        // Service Worker globals
        self: 'readonly',
        caches: 'readonly',
        
        // Node.js globals (for tests)
        global: 'readonly',
        require: 'readonly',
        __dirname: 'readonly',
        
        // Testing globals
        describe: 'readonly',
        it: 'readonly',
        test: 'readonly',
        expect: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
        vi: 'readonly',
        
        // App-specific globals
        updateStats: 'readonly',
        prepareLearningSession: 'readonly'
      }
    },
    plugins: {
      'unused-imports': unusedImports
    },
    rules: {
      // Неиспользуемые импорты
      'unused-imports/no-unused-imports': 'error',
      'unused-imports/no-unused-vars': [
        'warn',
        {
          vars: 'all',
          varsIgnorePattern: '^_',
          args: 'after-used',
          argsIgnorePattern: '^_'
        }
      ],
      
      // Неиспользуемые переменные
      'no-unused-vars': 'off', // Отключаем базовое правило, используем из unused-imports
      
      // Неиспользуемые функции
      'no-unused-expressions': 'error',
      
      // Неиспользуемые параметры
      'no-unused-labels': 'error',
      
      // Дублирующиеся переменные
      'no-shadow': 'error',
      'no-redeclare': 'error',
      
      // Неиспользуемые catch параметры
      'no-unused-vars': 'off',
      
      // Дополнительные правила для чистоты кода
      'no-console': 'warn', // Предупреждение о console.log
      'no-debugger': 'error',
      'no-alert': 'warn',
      
      // Игнорируем некоторые функции, которые используются в коде
      'no-undef': 'error',
      
      // Правила для качества кода
      'prefer-const': 'error',
      'no-var': 'warn', // Изменено с 'error' на 'warn' для глобальных переменных
      'no-empty': 'warn',
      'no-empty-function': 'warn'
    }
  },
  {
    files: ['tests/**/*.js'],
    languageOptions: {
      globals: {
        // Testing globals
        describe: 'readonly',
        it: 'readonly',
        test: 'readonly',
        expect: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
        vi: 'readonly'
      }
    },
    rules: {
      // Более мягкие правила для тестов
      'no-console': 'off',
      'unused-imports/no-unused-vars': 'warn'
    }
  }
];
