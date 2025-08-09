module.exports = {
  content: [
    'index.html',
    'js/**/*.js'
  ],
  css: [
    'css/**/*.css'
  ],
  safelist: [
    'detail-block',
    'theme-section',
    /^detail-block--/, 
    /^card-(translation|definition|examples)$/,
    /^metadata-chip/,
    /^word-card__/,
    /^action-btn/,
    /^progress-component__/,
    /^progress-indicator/,
    /^stat-card/,
    /^difficulty-btn/,
    /^btn(.*)?$/
  ],
  output: 'css/__purged'
};


