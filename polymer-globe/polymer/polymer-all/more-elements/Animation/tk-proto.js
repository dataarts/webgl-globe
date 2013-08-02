var tkAnimationProto = function(name) {
  return {
    publish: {
      animationName: name,
      targetLabel: '(no target)'
    },
    targetChanged: function() {
      this.super(),
      this.targetLabel = this.target ? this.target.id : '(no target)';
    },
    clickHandler: function(e) {
      if (!this.parentNode.apply) {
        setTimeout(this.play.bind(this), 500);
      }
      e.stopPropagation();
      e.preventDefault();
    }
  };
};
