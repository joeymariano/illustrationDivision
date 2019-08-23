/**
 * @namespace Momentum
 */
var Momentum = {};

/* Handle fixed header */
document.addEventListener && document.addEventListener('DOMContentLoaded', function() {
    if (!document.querySelector('#fullscreenBrowser')) {
      var content = document.querySelector('#mainContent');
      var headerHeight = document.querySelector('#header').offsetHeight;
      content.style.minHeight = document.querySelector('body').offsetHeight - headerHeight + 2 + 'px';
      content.style[document.querySelector('body.navigation-position-top') ? 'marginTop' : 'marginBottom'] = headerHeight - 2 + 'px';

      // realign after image load
      var logoImage = document.querySelector('#header .logo img');
      if (logoImage && !logoImage.complete) {
        logoImage.addEventListener('load', function() {
          content.style[document.querySelector('body.navigation-position-top') ? 'marginTop' : 'marginBottom'] = document.querySelector('#header').offsetHeight - 2 + 'px';
        });
      }
    }
});

Y.use('squarespace-gallery-ng', 'squarespace-fullscreen', function(Y) {

  var FULL_VERSION_MIN_WIDTH = 736,
      SAFARI_5_1_RELEASE = 534,
      foldersNavigation;

  Y.on('domready', function() {

    /* Fix for mobile info bar. */
    var mobileInfoBar = Y.one('.sqs-mobile-info-bar');

    if (mobileInfoBar) {
      var height = mobileInfoBar.get('clientHeight');
      var header = Y.one('#headerWrapper');
      var timeout;

      header.setStyle('transition', 'transform 0.1s ease');

      positionHeader();

      Y.one('.ctrl-button.menu').on('click', function () {
        Y.later(200, this, positionHeader);
      });

      Y.one('window').on('scroll', function (e) {
        timeout && timeout.cancel();
        timeout = Y.later(100, this, positionHeader);
      });
    }

    function positionHeader () {
      if (
        mobileInfoBar.hasClass('sqs-mobile-info-bar-hide') ||
        Y.one('body').hasClass('sqs-mobile-nav-open')
      ) {
        header.setStyles({
          'transform' : 'translatey(0)'
        });
      } else if (Y.one('.navigation-position-bottom')) {
        header.setStyles({
          'transform' : 'translatey(-' + height + 'px)'
        });
      }
    }
    /* End fix for mobile info bar. */

    var positionNavigation = function() {

      var mobileEnabled = Momentum.Browser.isMobileEnabled();

      // position social icons
      var $social = Y.one('#sqs-social');
      if ($social && Y.one('#mobile-navigation')) {
        if (mobileEnabled && Y.one('#header #sqs-social')) {
          Y.one('#mobile-navigation').append($social);
        } else if (!mobileEnabled && Y.one('#mobile-navigation #sqs-social')) {
          Y.one('#header .wrapper').append($social);
        }
      }

      // set nav width
      if (!mobileEnabled) {
        Y.one('#topNav').setStyle('paddingRight', ($social ? $social.width() : 0) + Y.one('.controls').width() + 'px');
      } else { // force simple arrows
        Y.one('body').removeClass('gallery-arrows-circle');
      }

      // Reset header to natural height
      if (!Y.one('#headerWrapper').hasClass('opened')) {
        Y.one('#headerWrapper').setStyle('height', null);
      }

    };

    Y.on(['resize', 'fullscreen:window-resized'], positionNavigation);
    positionNavigation();

    Y.one('body').addClass('loaded');

    // used in both index and gallery
    if (Y.one('#fullscreenBrowser')) {

      Momentum.Browser.init();

      Momentum.ProjectIndex.init();

      if (Y.one('body.gallery-initial-view-grid, body.gallery-initial-view-slideshow-homepage--grid:not(.homepage)')) {
        Momentum.ProjectIndex.show({
          skipAnim: true
        });
      } else if (Y.one('body.gallery-initial-view-infoview, body.gallery-initial-view-slideshow-homepage--infoview:not(.homepage)') && !Momentum.Browser.isMobileEnabled()) {
        Momentum.Browser.showInfo();
      }

      Y.Global.on('tweak:change', Y.bind(function(f){
        Momentum.Browser.repositionElements();
      }, this));

    }

    // setup mobile menu
    var mobileNav = Y.one('#mobile-navigation'),
        body = Y.one('body'),
        header = Y.one('#headerWrapper');
    if (mobileNav) {
      var navHeight = mobileNav.height();

      var toggleMenu = function() {
        body.toggleClass('sqs-mobile-nav-open');

        if (body.hasClass('sqs-mobile-nav-open')) {
          new Y.Anim({
            node: header,
            to: { height: window.innerHeight || body.get('winHeight') },
            easing: Y.Easing.easeInOutExpo,
            duration: 0.6
          }).run();
        } else {
          new Y.Anim({
            node: header,
            to: { height: header.one('#header').height() },
            easing: Y.Easing.easeInOutExpo,
            duration: 0.6
          }).run();
        }
      };

      Y.one('.ctrl-button.menu').on('click', function() {
        if (Momentum.ProjectIndex.isVisible()) {
          Momentum.ProjectIndex.hide({ callback: toggleMenu });
        } else {
          toggleMenu();
        }
      });

    } else {
      Y.one('body').addClass('mobile-nav-disabled');
    }


    //build subnav for folders (on every page)
    foldersNavigation = new FoldersNavigation(
      '.main-nav .folders-collection > a',
      Y.one('#headerWrapper'), {
        offset: {y: Y.one('#header').get('offsetHeight')/2}
      }
    );

  });


  /*
   * Toplevel manager for fullscreen browser
   */
  Momentum.Browser = (function() {

    var fullscreen,
        gallery;

    var viewport = {x: 0, y: 0},
        isTouchscreen = Modernizr.touch,
        loadingInterval,
        infoVisible = false,
        $container,
        $images,
        $slides,
        $header,
        $loadingIndicator,
        fullBrowserLoaded = false,
        fitOrFill,
        navLocation,
        mobileOnResizeStart,
        changedDisplayMode;

    function init() {

      $container = Y.one('#fullscreenBrowser');
      $images = $container.all('img[data-src]');
      $slides = $container.all('.slide');
      $header = Y.one('#headerWrapper');
      fitOrFill = Y.Squarespace.Template.getTweakValue('gallery-style');
      navLocation = Y.Squarespace.Template.getTweakValue('navigation-position');

      initFull();

      if (!isTouchscreen) {
        var resizer = new Y.Squarespace.ResizeEmitter({timeout: 300});
        resizer.on('resize:start', function() {
          mobileOnResizeStart = isMobileEnabled();
        });
        resizer.on('resize:end', function() {
          changedDisplayMode = mobileOnResizeStart !== isMobileEnabled();
          // fullscreen transitions shouldnt be considered a resize
          if (window.innerHeight !== screen.height) {
            Y.fire('fullscreen:window-resized');
          }
        });
      } else {
        Y.one(window).on('orientationchange', function() {
          Y.fire('fullscreen:window-resized');
        });
      }

    }

    function initFull() {
      refreshViewport();
      setup();

      fullBrowserLoaded = true;
    }

    function getScreenWidth() {
      return Y.one('body').get('winWidth');
    }

    /*
     * Loading sequence
     */
    function preload() {
      /*
      $loadingIndicator = Y.one('.guide-loading');
      loadingInterval = setInterval(function() {
        if (parseFloat($loadingIndicator.getStyle('opacity')) > 0.9) {
          fadeOut($loadingIndicator, 0.2);
        }
        else {
          fadeIn($loadingIndicator, 0.2);
        }
      }, 200); */
    }

    function setup() {
      function testCalcSupport() {
        var el = document.createElement('div');
        el.style.width = 'calc(50px)';
        return el.style.length === 1;
      }
      Momentum.Browser.supportsCalc = testCalcSupport();

      setupGallery();

      setTimeout(function() {postSetup();}, 1100);
    }

    /*
     * Enable fadeIn animation, set up events, build project index
     */
    function postSetup() {
      fadeIn(Y.one('#pageWrapper'));

      Momentum.FullscreenNavigation.init();

      registerBrowserEvents();

    }

    function setupGallery() {

      if (!fullscreen) {
        var setHeight = function() {
          var height = Momentum.Browser.supportsCalc ?
            'calc(100vh - ' + Y.one('#header').height() + 'px)' :
            Y.config.win.innerHeight - Y.one('#header').height();
          Y.one('.slideshow').setStyles({
            height: height,
            marginTop: Y.one('body.navigation-position-top') ? Y.one('#header').height() : 0
          });

          gallery && gallery.refresh();
        };

        Y.on('fullscreen:window-resized', setHeight);
        setHeight();

        var transition = Modernizr.touch ? 'swipe' : 'scroll';
        if (Y.Squarespace.Template.getTweakValue('gallery-transition') == 'Fade') {
          transition = 'fade';
        }

        fullscreen = new Y.Squarespace.Fullscreen({
          container: Y.one('.slideshow'),
          slides: '.slide',
          detectColor: (Y.Squarespace.Template.getTweakValue('color-detect-for-fullscreen')+'' === 'true'),
          designOptions: {
            easing: Modernizr.touch ? Y.Easing.easeOutExpo : Y.Easing.easeInOutExpo,
            speed: Y.one('body.gallery-transition-fade:not(.gallery-auto-play)') ? 0.5 : 1,
            autoHeight: false,
            preloadCount: 1,
            clickBehavior: false,
            transition: transition,
            transitionOptions: {
              direction: 'horizontal',
              zooming: false,
              accelerate: isGoodPhone()
            }
          },
          loaderOptions: {
            fit: fitOrFill == 'Center',
            fill: fitOrFill !== 'Center'
          },
          afterSlideChange: afterSlideChange,
          isTouchscreen: isTouchscreen
        });
      }

      checkLoader();

      gallery = fullscreen.getCurrentGallery();

      if (!gallery) {
        var load = Y.one('#loading-indicator');
        load && load.empty();
        return false;
      }

      gallery.on('reachedBeginning', function() {
        if (!Y.one('body.gallery-transition-fade')) {
          animateStuck('beginning');
        }
      });

      gallery.on('reachedEnd', function() {
        if (!Y.one('body.gallery-transition-fade')) {
          animateStuck('end');
        }
      });

      gallery.getImages().filter('.cover').each(function(img) {
        img.loader.set('mode', 'fill');
        img.fire('refresh');
      });

      if (Y.one('#fullscreenBrowser .slideshow > .sqs-active-slide .image-description')) {
        Y.one('.ctrl-button.info').show(true);
      } else {
        Y.one('.ctrl-button.info').hide(true);
      }

    }

    function registerBrowserEvents() {

      Y.one('.ctrl-button.all').on('click', function(event) {
        Momentum.ProjectIndex.show();
      });


      Y.one('.ctrl-button.close').on('click', function(event) {
        Momentum.ProjectIndex.hide();
      });

      Y.one('.ctrl-button.info').on('click', function(event) {
        if (infoVisible) {
          hideInfo();
        } else {
          showInfo();
        }
      });
      Y.on('fullscreen:window-resized', onWindowResize);

      if (gallery && gallery.get('designOptions.transition') !== 'swipe') {
        Y.one('.slideshow').on('click', function(event) {
          if(event.target.ancestor('.sqs-video-wrapper, .image-detail-wrapper') || Y.all('.slideshow .slide').size() <= 1) {
            return;
          }

          if(event.clientX > Y.one('body').get('winWidth')/2) {
            fullscreen.getCurrentGallery().nextSlide();
          } else {
            fullscreen.getCurrentGallery().previousSlide();
          }

        });

        Y.on('key', function(event) { event.preventDefault(); nextSlide(); }, document, 'arrowright');
        Y.on('key', function(event) { event.preventDefault(); previousSlide(); }, document, 'arrowleft');
        Y.on('key', function(event) { event.preventDefault(); Momentum.ProjectIndex.show(); }, document, 'arrowup');
        Y.on('key', function(event) { event.preventDefault(); Momentum.ProjectIndex.hide(); }, document, 'arrowdown');
        Y.on('key', function(event) {
          if (zinfoVisible) {
            hideInfo();
          } else {
            showInfo();
          }
        }, document, 'i');
      }

      new TweakListener('navigation-position', function(value) {

        repositionElements();
      });
    }

    function unregisterBrowserEvents() {
      if (fullscreen) {
        fullscreen.destroy();
        fullscreen = null;
      }
      Momentum.FullscreenNavigation.detach();
      Y.all('.ctrl-button').detachAll();
    }

    function checkLoader() {
      var $img = Y.one('#fullscreenBrowser .slideshow > .sqs-active-slide img');

      if ($img && !$img.get('complete')) {
        Y.one('#loading-indicator').removeClass('hide');
        $img.once('load', function() {
          Y.one('#loading-indicator').addClass('hide');
        });
      } else {
        Y.one('#loading-indicator').addClass('hide');
      }
    }

    function afterSlideChange(event) {
      var activeSlide = Y.one('#fullscreenBrowser .slideshow > .sqs-active-slide');
      if (activeSlide.one('.image-description')) {
        Y.one('.ctrl-button.info').show(true);
      } else {
        Y.one('.ctrl-button.info').hide(true);
      }

      positionInfo();
      checkLoader();

      if (Modernizr.touch && Y.one('.mobile-style-available')) {
        // we dont need arrows while swiping
        if (gallery.get('designOptions.transition') === 'swipe') {
          Y.all('.arrow-wrapper').removeClass('guide');
        } else { // but need on fade
          Y.all('.arrow-wrapper').addClass('guide');
        }
      }

      if (!activeSlide.previous()) {
        Y.one('.arrow-wrapper.left').removeClass('guide');
      } else if (!activeSlide.next()) {
        Y.one('.arrow-wrapper.right').removeClass('guide');
      }
    }

    function onWindowResize() {
      if (changedDisplayMode) {
        hideInfo(true);
      }
      refreshViewport();
      $images.each(function(image) {
        image.fire('refresh');
      });
    }

    function refreshViewport() {
      viewport.x = Y.one('body').get('winWidth'),
      viewport.y = Y.one('body').get('winHeight');
      var viewableHeight = viewport.y - $header.get('offsetHeight');

      if (Momentum.ProjectIndex.isVisible()) {
        Y.one('#headerWrapper').setStyles({height: viewport.y});
      }

      if (Y.one('body.show-info')) {
        positionInfo();
      }
    }

    function isMobileEnabled() {
      return Y.one('body').get('winWidth') <= FULL_VERSION_MIN_WIDTH;
    }

    function nextSlide() {
      gallery.nextSlide();
    }

    function previousSlide() {
      gallery.previousSlide();
    }

    function moveTo(index) {
      gallery.set('currentIndex', index);
    }

    function repositionElements() {

      // repositionProjectTitle();

      // reposition any elements here
    }

    function showInfo() {

      if (Momentum.ProjectIndex.isVisible()) {
        Momentum.ProjectIndex.hide({ callback: _show });
      } else {
        _show();
      }
      function _show() {

        if (!isMobileEnabled()) {
          Y.one('body').addClass('show-info');

          var overlays = [];
          $images.each(function(image) {

            if (image.ancestor('.has-info')) {
              var videoWrapper = image.ancestor('.sqs-video-wrapper');
              if (videoWrapper) {
                videoWrapper.plug(Y.Squarespace.VideoLoader, {
                  mode: 'fit'
                });
                var overlay = videoWrapper.one('img');
                overlay && overlays.push(overlay);
              } else {
                image.plug(Y.Squarespace.Loader2, {
                  mode: 'fit'
                });
              }
            }

          });
          if (typeof gallery == 'undefined') {
            return false;
          } else {
            gallery.refresh();
          }

          overlays.forEach(function(img) { // video overlays must be fit
            img.loader.set('mode', 'fit').fire('refresh');
          });

          positionInfo();
        } else {
          Y.one('body').addClass('show-info-mobile');
        }

        fullscreen.adjustColors();
        infoVisible = true;

      }
    }

    function positionInfo() {
      if (isMobileEnabled() || !Y.one('body.show-info')) {
        return;
      }

      var positionSlide = function($slide) {
        var $info = $slide.one('.image-detail-wrapper'),
            $img = $slide.one('img, iframe');

        if(!$info) return;

        // use video wrapper for positioning
        $img = $img.ancestor('.sqs-video-wrapper') || $img;

        // refresh images not loaded yet
        if (!$img.get('complete')) {
          $img.fire('refresh');
        }

        var imageW = parseInt($img.getStyle('width')),
            imageH = parseInt($img.getStyle('height')),
            slideW = $slide.width(),
            slideH = $slide.height(),
            infoW = parseInt($info.getComputedStyle('width')),
            infoH = Math.min(parseInt($info.getComputedStyle('height')), slideH - 40),
            infoTop = Math.max(slideH/2 - infoH/2, 20),
            infoLeft = imageW + (slideW - imageW)/2 - infoW/2,
            paddingRight = slideW - infoLeft - infoW;

        if (Y.one('body.gallery-style-center') && $img.getXY()[0] > 0) {

          var padding = 50,
              contentWidth = imageW + 3*padding + infoW,
              containerWidth = slideW,
              imgOffset = (containerWidth - contentWidth)/2;

          infoLeft = padding + imgOffset + imageW + padding;
          $img.setStyles({
            left: imgOffset + 'px !important'
          });
        }

        $info.setStyles({
          top: infoTop + 'px',
          left: infoLeft + 'px',
          height: infoH,
          paddingRight: paddingRight
        });
      };

      var $slide = $slides.item(gallery.get('currentIndex'));
      positionSlide($slide);
      $slide.next() && positionSlide($slide.next());
      $slide.previous() && positionSlide($slide.previous());

    }

    /**
     * This was borrowed from scripts-v6/util.js to remove the template level
     * dependency on the Y.Squarespace.Rendering namespace.
     *
     * @method getDimensionsFromNode
     * @param  {Node} node
     * @return {Object}
     */
    function getDimensionsFromNode(node) {
      var val = node.getAttribute('data-image-dimensions');

      if (!val) {
        return {
          width: null,
          height: null
        };
      } else if (Y.Lang.isString(val)) {
        val = val.split('x');
        return {
          width: parseInt(val[0], 10),
          height: parseInt(val[1], 10)
        };
      }
    }

    function hideInfo(force) {
      if (!isMobileEnabled() || force) {
        Y.one('body').removeClass('show-info');

        $images.each(function(image) {
          var fitOrFill = image.hasClass('cover') ? 'Full Bleed' : Y.Squarespace.Template.getTweakValue('gallery-style');

          var videoWrapper = image.ancestor('.sqs-video-wrapper');
          if (videoWrapper) {
            videoWrapper.setStyles({
              width: null,
              height: null,
              left: null,
              top: null
            }).plug(Y.Squarespace.VideoLoader, {
              mode: fitOrFill == 'Center' ? 'fit' : 'fill'
            });
          } else {
            image.plug(Y.Squarespace.Loader2, {
              mode: fitOrFill == 'Center' ? 'fit' : 'fill'
            });
          }

        });
        if (typeof gallery == 'undefined') {
          return false;
        } else {
          gallery.refresh();
        }

        Y.one('#fullscreenBrowser .slideshow > .sqs-active-slide .image-detail-wrapper').setStyle('left', Y.one('body').get('winWidth'));
      } else if (isMobileEnabled()) {
        Y.one('body').removeClass('show-info-mobile');
      }

      fullscreen.adjustColors();
      infoVisible = false;
    }

    function animateStuck(whichEnd) {
      //var className = (Y.UA.safari > 0 && (Y.UA.safari < SAFARI_5_1_RELEASE)) ? 'reached-' + whichEnd + '-older' : 'reached-' + whichEnd;
      var className = 'reached-' + whichEnd;
      $container.addClass(className);
      setTimeout(function() {
        $container.removeClass(className);
      }, 550);
    }

    function isGoodPhone() {
      return Y.UA.ipad >= 6 || Y.UA.iphone >= 6 || Y.UA.android >= 3
    }

    return {
      init: init,
      getViewport: function() { return viewport; },
      getGallery: function() { return gallery; },
      moveTo: moveTo,
      refreshDimension: function() {
        Y.fire('fullscreen:window-resized');
      },
      repositionElements: repositionElements,
      showInfo: showInfo,
      hideInfo: function(callback) {
        hideInfo(callback);
      },
      isInfoVisible: function() {
        return infoVisible;
      },
      isMobileEnabled: isMobileEnabled,
      isGoodPhone: isGoodPhone
    }
  })();

  Momentum.FullscreenNavigation = (function() {

    function init(onClick) {
      if (Y.all('.slideshow .slide').size() <= 1) {
        return;
      }

      Y.one('.arrow-wrapper.right').addClass('guide');

      if (!Modernizr.touch) {
        Y.one('body').on('mousemove', function(event) {
          if(event.clientX <= Y.one('body').get('winWidth')/2 && Y.one('#fullscreenBrowser .slideshow > .sqs-active-slide').previous()) {
            Y.one('.arrow-wrapper.left').addClass('guide').siblings().removeClass('guide');
          } else if(event.clientX > Y.one('body').get('winWidth')/2 && Y.one('#fullscreenBrowser .slideshow > .sqs-active-slide').next()) {
            Y.one('.arrow-wrapper.right').addClass('guide').siblings().removeClass('guide');
          }
        });

        Y.one('body').on('mouseleave', function() {
          Y.all('.arrow-wrapper').removeClass('guide');
        });
      }


      var positionArrows = function() {
        Y.all('.arrow-wrapper').setStyle(Y.one('body.navigation-position-top') ? 'top' : 'bottom', parseInt(Y.one('.slideshow').height()/2) + Y.one('#header').height() - Y.one('.arrow-wrapper').height()/2 + 'px');
      };
      positionArrows();
      Y.on('fullscreen:window-resized', positionArrows);
    }

    function detach() {
      Y.all('.nav-button').detachAll();
    }

    return {
      init: init,
      detach: detach
    }
  })();

  /*
   * Interface for projects index overlay
   */
  Momentum.ProjectIndex = (function() {

    var $container,
        $header,
        grids = [],
        visible = false,
        ready = false;

    function init() {
      if (ready) return;

      $container = Y.one('#indexProjects');
      $header = Y.one('#headerWrapper');

      $header.append($container);

      setup();
      ready = true;
    }

    function loadImages() {
      var aspectRatio = 1,
          tweakValue = Y.Squarespace.Template.getTweakValue('index-aspect-ratio'),
          splitVal = tweakValue && tweakValue.split(':');

      if (splitVal && splitVal.length > 1) {
        aspectRatio = splitVal[0]/splitVal[1];
      }

      $container.all('.thumb-grid').each(function(grid, i) {
        grids.push(new Y.Squarespace.Gallery2({
          container: grid,
          design: 'autocolumns',
          designOptions: {
            columnWidth: Momentum.Browser.isMobileEnabled() ? Y.one('body').get('winWidth')/3 - 20 : 225,
            columnWidthBehavior: 'min',
            gutter: Momentum.Browser.isMobileEnabled() ? 16 : 37,
            aspectRatio: aspectRatio
          },
          loaderOptions: { load: false },
          lazyLoad: true,
          refreshOnResize: true
        }));
      });

    }

    function bloomInEl(el, opts) {
      opts = opts || {};

      function bloom() {
        if (Y.Squarespace.Template.getTweakValue('index-aspect-ratio') === 'Auto') {
          el.loader.set('mode', 'fit');
        }
        el.fire('refresh');
        el.addClass('bloomed');
      }

      if (opts.delay) {
        Y.later(opts.delay, this, bloom);
      } else {
        bloom();
      }

    }

    /*
     * Build project index grid and overlay
     */
    function setup() {
      var thumbs = $container.all('.thumb');
      thumbs.each(function(item, index) {
        item.on('click', onClick);
        item.setAttribute('data-accum-index', index);

        var img = item.one('img');

        if (Modernizr.touch && !Momentum.Browser.isGoodPhone()) {
          img.addClass('crashprone');
        }

        if (img.get('src') !== '' && img.get('complete')) {
          item.one('.sqs-spin').addClass('hide');
          bloomInEl(img, {
            delay: Math.random() * 300
          });
        } else {
          img.once('load', function() {
            item.one('.sqs-spin').addClass('hide');
            bloomInEl(img, {
              delay: Math.random() * 300
            });
          }, this);
        }

      });

      loadImages();
    }

    function onClick(event) {
      event.stopPropagation();
      hide();
      Momentum.Browser.moveTo(parseInt(event.currentTarget.getAttribute('data-accum-index')));
    }

    function show(options) {
      options = options || {};

      var targetHeight = window.innerHeight || Y.one('body').get('winHeight');

      $container.removeClass('hidden');

      if (options.skipAnim) {
        $header.setStyle('height', targetHeight + 'px');
      } else {
        var anim = new Y.Anim({
          node: $header,
          to: {height: targetHeight },
          easing: Y.Easing.easeInOutExpo,
          duration: 0.6
        });
        anim.on('end', function() {
          for(var i=0; i<grids.length; i++) {
            grids[i]['gallery-design'].loadItems();
          }
          if (typeof options.callback == 'function') {
            options.callback();
          }
        });
        anim.run();
      }

      visible = true;
      $header.addClass('opened');

      if (typeof gallery == 'undefined') {
        return false;
      } else {
        Momentum.Browser.getGallery().set('autoplay', false);
      }
    }

    function hide(options) {
      options = options || {};

      if (options.skipAnim) {
        $header.setStyle('height', Y.one('#header').get('clientHeight'));
        $container.addClass('hidden');
        $header.removeClass('opened');
      } else {
        var anim = new Y.Anim({
          node: $header,
          to: {height: Y.one('#header').get('clientHeight')},
          easing: Y.Easing.easeInOutExpo,
          duration: 0.6
        });
        anim.on('end', function() {
          if (typeof options.callback == 'function') {
            options.callback();
          }
          $container.addClass('hidden');
          $header.removeClass('opened');
        });
        anim.run();
      }

      visible = false;

      if (typeof gallery == 'undefined') {
        return false;
      } else {
        Momentum.Browser.getGallery().set('autoplay', Y.Squarespace.Template.getTweakValue('gallery-auto-play') === 'true');
      }
    }

    return {
      hide: function(callback) {
        hide(callback);
      },
      init: init,
      isVisible: function() {
        return visible;
      },
      show: function(callback) {
        show(callback);
      }
    }
  })();


  /*
   * Smooth scrolling
   */
  function scrollTo(element, duration, callback) {
    if (!element) {return false;}
    var scrollNodes = (Y.UA.gecko || Y.UA.ie) ? 'html' : 'body';
    var position = element.getXY();
    if (position[1] == 0) { position[1] = -10; } // workaround to really force y=0
    if (!duration) { duration = 0.4; }
    var anim = new Y.Anim({ node: document.scrollingElement || scrollNodes, to: { scroll: position }, duration: duration, easing: Y.Easing.easeInOutExpo});
    if (typeof callback == 'function') {
      anim.on('end', callback(position));
    }
    anim.run();
  }

  function fadeIn(element, duration, callback) {
    if (!duration) { duration = 0.5; }
    var anim = new Y.Anim({
      node: element,
      to: { opacity: 1 },
      duration: duration
    });
    if (typeof callback == 'function') {
      anim.on('end', callback());
    }
    anim.run();
  }

  function fadeOut(element, duration, callback) {
    if (!duration) { duration = 0.5; }
    var anim = new Y.Anim({
      node: element,
      to: { opacity: 0 },
      duration: duration
    });
    if (typeof callback == 'function') {
      anim.on('end', callback());
    }
    anim.run();
  }

  /*
   * Given hex string, returns whether the color is bright or dark
   */
  function isBright(hexcolor) {
    hexcolor = hexcolor.replace('#', '');
    return (parseInt(hexcolor, 16) > 0xffffff/2);
  }

  function getStyleSheet(filename) {
    for(var i=0; i<document.styleSheets.length; i++) {
      var sheet = document.styleSheets[i];
      if(sheet.href && sheet.href.indexOf(filename) > -1) {
        return sheet;
      }
    }
    return null;
  }


  var FoldersNavigation = function (selector, headerContainer, options) {

    var settings = {
      position: 'bottom',
      subnavClass: 'subnav',
      offset: {x: 0, y: 0}
    }
    var foldersSubnavCSS = {
      position: 'fixed'
    }

    var mode = 'relative';

    function init() {
      settings = Y.merge(settings, options);
      Y.all(selector).each(function(item) {
        new FolderUI(item, headerContainer);
      });

      Y.one(window).on('scroll', function() {
        Y.all('.'+settings.subnavClass).setStyle('display', 'none');
      });
    }
    init();

    function FolderUI(element, headerContainer) {
      var $trigger,
          $container,
          $subnav,
          $header,
          $subnavUl = Y.all('.subnav ul'),
          $subnavLi = Y.all('.subnav ul li a'),
          timer;
      function init() {
        $trigger = element;

        if (headerContainer) {
          $header = headerContainer;
          mode = 'fixed';
        }
        $container = $trigger.get('parentNode');
        if (!$container) return false;
        $container.addClass('subnav-ready');
        $subnav = $container.one('.'+settings.subnavClass);
        $subnav && $subnav.setStyles(foldersSubnavCSS);

        if ($header) {
          $header.get('parentNode').append($subnav);
        }

        if ($subnav) {
          $trigger.on('hover',
            function(event) { hoverTrigger(event); },
            function(event) { readyToHide(event); }
          );

          $subnav.on('hover',
            function(event) { cancelHide(); },
            function(event) { readyToHide(event); }
          );

          // $subnav.on('mouseout', function(event){
          //   readyToHide();
          // });

          // $subnavUl.on('hover',
          //   function() {
          //     readyToHide();
          //   });
          // $subnavLi.on('hover',
          //   function() {
          //     readyToHide();
          //   });

          $subnav.on('click', function() {
            hideSubnav();
          });
          if (Modernizr && Modernizr.touch) {
            // prevent folder clickthrough for touch device
            $trigger.on('click', function(event) { event.preventDefault(); });
          }
        }
      }
      init();

      function hoverTrigger(event) {
        cancelHide();
        Y.all('.'+settings.subnavClass).setStyles({'display': 'none'});

        $subnav.setStyles({
          display: 'block',
          maxHeight: Y.one('body').get('winHeight') - Y.one('#header').height() - 5 + 'px'
        });
        var position = (mode == 'relative') ? getRelativePosition() : getFixedPosition();
        $subnav.setStyles(position);

        //TODO: take care of edge cases for off screen
        var position = $subnav.getXY();
        if (position[1] < 0) {
          if (mode == 'fixed') {
            $subnav.setStyle('top', $container.get('offsetHeight')+$container.getXY()[1]);
          } else {
            $subnav.setStyle('top', $container.get('offsetHeight'));
          }
        }

      }

      function getRelativePosition() {
        var pos = {top: 0, left: 0},
            left = (parseInt($container.getComputedStyle('marginLeft'))) || 10;
        if (settings.position == 'bottom') {
          pos.top = $container.get('offsetHeight');
          pos.left = -(left*2);
        } else if (settings.position == 'top') {
          pos.top = -($container.get('offsetHeight')+$subnav.get('offsetHeight'));
          pos.left = -(left*2);
        }
        return pos;
      }

      function getFixedPosition() {
        var pos = {top: 0, left: 0},
            parentPos = $container.getXY(),
            fromTop = Y.one('#headerWrapper').get('offsetTop');

        if (fromTop < 100) { // top
          pos.top = $header.one('#header').height() + 1 + 'px';
          pos.bottom = 'auto';
          pos.left = parentPos[0]-((parseInt($container.getComputedStyle('marginLeft'))) || 10);
        } else {
          var subnavPadding = 0;  // $subnav.getComputedStyle('padding');
          // subnavPadding = (subnavPadding) ? parseInt(subnavPadding) : 15;
          pos.bottom = $header.one('#header').height() + 1 + 'px';
          pos.top = 'auto';
          pos.left = parentPos[0]-((parseInt($container.getComputedStyle('marginLeft'))) || 10);
        }
        return pos;
      }

      function hoverSubnav(event) {
        cancelHide();
      }

      function readyToHide() {
        if (!timer) {
          timer = setTimeout(function() {
            hideSubnav();
          }, 300);
        }
      }

      function cancelHide() {
        if (timer) {
          clearTimeout(timer);
          timer = null;
        }
      }

      function hideSubnav() {
        $subnav.setStyle('display', 'none');
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

        Y.Global.on('tweak:close', function() {
          Y.later(500, this, function() {
            Y.fire('fullscreen:window-resized');
          });
        });
      }
    }
    init();
  };

  // There is a bug in indexes where the wrong sized image
  // sometimes gets loaded in Safari. It's an ugly hack but
  // it's also a really easy way to fix the problem for now.
  // @kfoley Sep 30, 2015.
  if (Y.UA.safari && !Y.UA.mobile) {
    Y.all('img[data-src]').each(function(img) {
      img.on('load', function() {
        Y.later(100, this, function() {
          Y.one('window').simulate('resize');
        });
      })
    });
  }

  Y.Node.DOM_EVENTS.key.eventDef.KEY_MAP.arrowup = 38;
  Y.Node.DOM_EVENTS.key.eventDef.KEY_MAP.arrowdown = 40;
  Y.Node.DOM_EVENTS.key.eventDef.KEY_MAP.arrowleft = 37;
  Y.Node.DOM_EVENTS.key.eventDef.KEY_MAP.arrowright = 39;

  Y.Easing.easeInOutExpo = function (t, b, c, d) {
    if (t==0) return b;
    if (t==d) return b+c;
    if ((t/=d/2) < 1) return c/2 * Math.pow(2, 10 * (t - 1)) + b;
    return c/2 * (-Math.pow(2, -10 * --t) + 2) + b;
  };
});


//    Custom Code for Illustration Division by Ms. Joey Michalina Mariano
//    joeymariano.com
//    illustrationdivision.com

function scrollDown(el_name){
  let element = document.querySelector(el_name)
  let headerHeight = document.querySelector('#header').offsetHeight
  let elementY = element.getBoundingClientRect().y
  // let totalHeight = document.documentElement.offsetHeight
  // let browserScrollPosition = document.documentElement.offsetHeight

  scrollTo(0, elementY, fadeAndDeleteArrow('.downArrowContainer'));
}

function fadeAndDeleteArrow(el) {
    let element = document.querySelector(el)
    let op = 1;  // initial opacity
    let timer = setInterval(function () {
        if (op <= 0.1){
            clearInterval(timer);
            element.style.display = 'none';
            element.parentNode.removeChild(element) // delete when done
        }
        element.style.opacity = op;
        element.style.filter = 'alpha(opacity=' + op * 100 + ")";
        op -= op * 0.1;
    }, 50);
}

function stretchImage() {
  // hide How We Work text
  let howWeWork = document.getElementById('block-yui_3_17_2_1_1563310970536_28677')
  howWeWork.style.display = 'none'

  let html = document.getElementsByTagName('html')[0]
  html.style.setProperty('overflow', 'hidden')

  // imag reposition
  let winWidth = window.innerWidth
  let xStart = (winWidth / 4) 
  let image = document.getElementsByTagName('img')[0]
  image.style.setProperty('position', 'fixed')
  image.style.setProperty('z-index', '-999')
  image.style.setProperty('top', '0')
  image.style.setProperty('left', xStart.toString() + 'px')
  image.style.setProperty('max-height', window.innerHeight)

  // paragraph manipulation
  let paragraph = document.getElementsByTagName('p')[0]
  paragraph.style.setProperty('margin-right', winWidth/16 + 'px')
  paragraph.style.setProperty('font-size', '.8em')
  paragraph.style.setProperty('text-align', 'justify')

  // rotate about us
  let aboutUs = document.getElementsByTagName('h1')[3]
  aboutUs.style.setProperty('transform-origin', 'left')  
  aboutUs.style.setProperty('transform', 'rotate(-90deg)')
  aboutUs.style.setProperty('position', 'sticky')
  aboutUs.style.setProperty('top', '0')
  aboutUs.style.setProperty('left', '0')
  aboutUs.style.setProperty('margin-top', '175px')
}