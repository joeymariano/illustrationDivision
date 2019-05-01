YUI.add( 'squarespace-fullscreen', function( Y ) {

  Y.namespace( 'Squarespace' );

  var settings = {
    container: null,
    slides: '.slide',     /* string selector of slide elements */
    elements: {
      next: '.arrow-wrapper.right',
      previous: '.arrow-wrapper.left',
      controls: '#dotControls, #numberControls, #tinyThumbControls'
    },
    loop: false,
    detectColor: false,
    designOptions: {
      clickBehavior: true,
      // easing: Y.Easing.easeInOutExpo,
      speed: 1,
      autoHeight: false,
      preloadCount: 2,
      transition: 'fade',
      transitionOptions: { }
    },
    loaderOptions: { fill: true },
    refreshOnResize: true,
    refreshOnOrientationChange: true,
    afterInit: null,
    onSlideChange: null,
    afterSlideChange: null,
    touchHandler: {
      onSwipeDown: null,
      onSwipeUp: null
    },
    isTouchscreen: false,
    colorDetectCorners: ['topLeft', 'topRight', 'bottomLeft', 'bottomRight', 'suggestedbg']
  };

  Y.Squarespace.Fullscreen = function(userSettings) {

    settings = Y.merge(settings, userSettings);

    var galleries = [],
        galleryIndex = 0,
        $images;

    var autoPlay  = (Y.Squarespace.Template.getTweakValue('gallery-auto-play')+'' === "true"),
        playSpeed = parseFloat(Y.Squarespace.Template.getTweakValue('galleryPlaySpeed')),
        fitOrFill = Y.Squarespace.Template.getTweakValue('gallery-style');

    function init() {

      if (!Y.one(settings.slides)) {
        return false;
      }

      if (!settings.container) {
        throw 'container is required';
      }
      var galleryConfig = {
        container: null,
        slides: settings.slides,
        elements: {
          next: settings.elements.next,
          previous: settings.elements.previous,
          controls: settings.elements.controls
        },
        lazyLoad: true,
        loop: autoPlay,
        autoplay: autoPlay,
        autoplayOptions: {
          randomize: false,
          timeout: playSpeed * 1000,
          pauseOnMouseover: []
        },
        design: 'stacked',
        designOptions: settings.designOptions,
        keyboard: false,
        loaderOptions: settings.loaderOptions,
        refreshOnResize: settings.refreshOnResize,
        // deeplink urls for gallery collections only (indexes tricky)
        historyHash: Y.one('body').hasClass('collection-type-gallery')
      };

      if (settings.container._nodes) {
        settings.container.each(function(container) {
          $images = Y.all(settings.slides + ' img[data-src]');
        });

        for (var i=0; i<settings.container.size(); i++) {

          galleryConfig.container = settings.container.item(i);

          var gallery = new Y.Squarespace.Gallery2(galleryConfig);
          gallery.on('currentIndexChange', function(event) {
            Y.fire('fullscreen:on-slide-change', event);
          });

          gallery.after('currentIndexChange', function(event) {
            Y.fire('fullscreen:after-slide-change', event);
          });
          galleries.push(gallery);
        }
      } else {
        $images = settings.container.all('img[data-src]');

        galleryConfig.container = settings.container;
        var gallery = new Y.Squarespace.Gallery2(galleryConfig);

        gallery.on('currentIndexChange', function(event) {
          Y.fire('fullscreen:on-slide-change', event);
        });

        gallery.after('currentIndexChange', function(event) {
          Y.fire('fullscreen:after-slide-change', event);
        });
        galleries.push(gallery);
      }

      adjustColors(0);

      setupTweakListener();

      if (typeof settings.afterInit == 'function') {
        settings.afterInit();
      }
      Y.on('fullscreen:on-slide-change', function(e) { onSlideChange(e); });
      Y.on('fullscreen:after-slide-change', function(e) { afterSlideChange(e); });

    }
    init();

    this.getGallery = function(value) {
      return galleries[value];
    };

    this.getCurrentGallery = function() {
      return galleries[galleryIndex];
    };

    this.getGalleries = function() {
      return galleries;
    }

    this.refresh = function() {
      for (var i=0; i<galleries.length; i++) {
        galleries[i].refresh();
      }
    };

    this.getGalleryIndex = function(value) {
      return galleryIndex;
    };

    this.setGalleryIndex = function(value) {
      if (value < 0) {
        value = 0;
      }
      galleryIndex = value;
    };

    this.isLastEntry = function() {
      var currentGallery = galleries[galleryIndex];
      return (currentGallery.get('slides').size()-1 == currentGallery.get('currentIndex'));
    };

    this.isLastGallery = function() {
      return (galleryIndex == galleries.length-1);
    }

    this.destroy = function() {
      for (var i=0; i<galleries.length; i++) {
        galleries[i].destructor();
      }
    };

    this.adjustColors = function() {
      adjustColors(galleries[galleryIndex].get('currentIndex'));
    }

    function onSlideChange(event) {
      if (typeof settings.onSlideChange == 'function') {
        settings.onSlideChange(event);
      }
    }

    function afterSlideChange(event) {
      adjustColors(galleries[galleryIndex].get('currentIndex'));

      if (typeof settings.afterSlideChange == 'function') {
        settings.afterSlideChange(event);
      }

    }

    function getWindowWidth() {
      return Y.one('body').get('winWidth');
    }

    function adjustColors(slideIndex) {
      var slideImage = galleries[galleryIndex].getSlides().item(slideIndex).one('img'),
          bodyClasses = Y.one('#canvas').get('className'),
          currentColor;

      if (!slideImage) return;

      // Adjust foreground colors
      bodyClasses = bodyClasses.replace(/color-weight-[\w|\-]*\b/g, ''); // remove color weight classes
      Y.one('#canvas').set('className', bodyClasses);
      Y.Array.each(settings.colorDetectCorners, function(corner) {
        corner = corner.toLowerCase();
        var weight = slideImage.getAttribute('data-weight-'+corner);
        if (weight) {
          Y.one('#canvas').addClass('color-weight-'+corner+'-'+weight);
        }
      });

      // And background color
      if (Y.one('body.color-detect-gallery-background')) {
        var slide = galleries[galleryIndex].getSlides().item(slideIndex),
            color = slideImage.getAttribute('data-color-suggestedbg');
        if (color) {
          Y.one('body').setStyle('backgroundColor',color);
          if (Y.one('body').get('winWidth') < 640 && slide.one('.has-info')) {
            slide.one('.image-detail-wrapper').setStyle('backgroundColor', color);
          }
        }

        currentColor = color;
      } else {
        currentColor = Y.one('body.show-info .sqs-active-slide .imageWrapper.has-info, body.gallery-style-center') ? Y.one('body').getStyle('background-color') : slideImage.getAttribute('data-color-suggestedbg') || slideImage.getAttribute('data-color-topright');
      }

      if (currentColor) {
        var rgba = currentColor.match(new RegExp('rgba?\\((\\d+),\\s*(\\d+),\\s*(\\d+)'));
        if (rgba) {
          currentColor = rgb2hex(rgba[1],rgba[2],rgba[3]);
        }

        Y.one('#canvas').addClass('color-weight-' + getLightness(currentColor));
      }
    }

    function rgb2hex(r, g, b) {
      var parts = [r,g,b];

      for (var i = 0; i <= 2; ++i) {
        parts[i] = parseInt(parts[i], 10).toString(16);

        if (parts[i].length == 1)
          parts[i] = '0' + parts[i];
      }

      return '#'+parts.join('');
    }

    function getLightness(hexcolor) {
      if (hexcolor && hexcolor.length > 0 && hexcolor.length <= 7) {
        hexcolor = hexcolor.replace('#', '');
        return ((parseInt(hexcolor, 16) > 0xffffff/2) ? 'light' : 'dark');
      } else {
        return '';
      }
    }

    function setupTweakListener() {

      var bRefresh = false;
      new TweakListener('gallery-transition', function(value) {
        bRefresh = true;
      });

      new TweakListener('gallery-index-style', function(value) {
        bRefresh = true;
      });

      new TweakListener('gallery-initial-view', function(value) {
        bRefresh = true;
      });

      new TweakListener('gallery-auto-play', function(value) {
        for (var i=0; i<galleries.length; i++) {
          galleries[i].set('autoplay', value);
        }
      });

      new TweakListener('galleryPlaySpeed', function(value) {
        for (var i=0; i<galleries.length; i++) {
          galleries[i].set('autoplayOptions.timeout', value*1000);
        }
      });

      new TweakListener('gallery-style', function(value) {
        $images.each(function(image) {
          refreshImageStyle(image, image.hasClass('cover') ? 'Fill' : value);
        });
      });

      /*
      new TweakListener('color-detect-for-fullscreen', function(value) {
        settings.detectColor = (value === "true");
        if (settings.detectColor) {
          adjustColors(galleries[galleryIndex].get('currentIndex'));
        } else {
          galleries[galleryIndex].getSlides().setStyle('backgroundColor', null);
        }
      }); */

      Y.Global.on('tweak:beforeopen', Y.bind(function(f){
        Y.later(500, this, function() {
          for (var i=0; i<galleries.length; i++) {
            galleries[i].refresh();
          }
        });
      }));

      Y.Global.on('tweak:close', Y.bind(function(f){
        if (bRefresh) {
          window.location.reload(true);
        }
      }));
    }

    function refreshImageStyle(image, fitOrFill) {
      if (image && image.loader) {
        if (fitOrFill == 'Center') {
          image.loader.setAttrs({fit: true});
        } else {
          image.loader.setAttrs({fill: true});
        }
      }
    }

  };

  var TweakListener = function(tweakName, callBack) {
    function init() {
      if (Y.Global) {
        Y.Global.on('tweak:change', Y.bind(function(f){
          if ((f.getName() == tweakName) && (typeof callBack === 'function')) {
            callBack(f.getValue());
          }
        }));
      }
    }
    init();
  };


}, '1.0', { requires: [ 'node' ] });


