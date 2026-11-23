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
    /^detail-block--/, 
    /^card-(translation|definition|examples)$/,
    /^metadata-chip/,
    /^word-card__/,
    /^action-btn/,
    /^progress-indicator/,
    /^difficulty-btn/,
    /^btn(.*)?$/
  ],
  output: 'css/__purged'
};


