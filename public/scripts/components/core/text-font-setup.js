function setupTextFont(textElement) {
  if (!textElement || textElement.tagName !== 'A-TEXT') {
    return;
  }
  
  const fontPath = '/assets/fonts/Exo2-Regular-msdf.json';
  const fontImagePath = '/assets/fonts/Exo2-Regular.png';
  
  textElement.setAttribute('font', fontPath);
  textElement.setAttribute('font-image', fontImagePath);
  textElement.setAttribute('negate', false);
}

AFRAME.registerComponent('text-font-setup', {
  init: function () {
    if (this.el.tagName === 'A-TEXT') {
      setupTextFont(this.el);
    }
    
    this.observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === 1) {
            if (node.tagName === 'A-TEXT') {
              setupTextFont(node);
            }
            const textChildren = node.querySelectorAll && node.querySelectorAll('a-text');
            if (textChildren) {
              textChildren.forEach(setupTextFont);
            }
          }
        });
      });
    });
    
    this.observer.observe(this.el, {
      childList: true,
      subtree: true
    });
    
    const existingTexts = this.el.querySelectorAll('a-text');
    existingTexts.forEach(setupTextFont);
  },
  
  remove: function () {
    if (this.observer) {
      this.observer.disconnect();
    }
  }
});

if (typeof window !== 'undefined') {
  window.setupTextFont = setupTextFont;
}

