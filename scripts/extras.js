// Extra JS

// Announcement Bar fix for when header is top

YUI().use('node', 'event', function (Y) {
	Y.on('domready', function() {

    var announcementBar = Y.one('.sqs-announcement-bar');
    var headerTop = Y.one('.navigation-position-top');

    if (announcementBar && headerTop) {

      var offset                = announcementBar.get('clientHeight');
      var announcementBarClose  = Y.one('.sqs-announcement-bar-close');
      var header                = Y.one('#headerWrapper');
      var page                  = Y.one('#page');
      var subNav                = Y.one('.nav.subnav');


      if (header && announcementBarClose && page) {

        if(subNav){
          var offsetSubNav          = subNav.get('offsetHeight');
          subNav.setStyle('marginTop', (offset + offsetSubNav) + 'px');
        }

        header.setStyle('top', offset);
        page.setStyle('top', offset);

        announcementBarClose.on('click', function(){
          if(subNav){
            subNav.setStyle('marginTop', offsetSubNav);
          }
          header.setStyle('top', '0');
          page.setStyle('top', '0');
        });
      }

      // if (header && announcementBarClose && page && subNav) {
      //   var offsetSubNav          = subNav.get('offsetHeight');
      //   header.setStyle('top', offset);
      //   page.setStyle('top', offset);
      //   subNav.setStyle('marginTop', (offset + offsetSubNav) + 'px');

      //   announcementBarClose.on('click', function(){
      //     header.setStyle('top', '0');
      //     page.setStyle('top', '0');
      //     subNav.setStyle('marginTop', offsetSubNav);
      //   });

      // }
    }
	});
});
