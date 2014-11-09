/*
 *  Project: Slidatron
 *  Description: A basic slider with drag / touch support
 *  Author: Aaron Latham-Ilari
 *  License: BSD
 */

// the semi-colon before function invocation is a safety net against concatenated
// scripts and/or other plugins which may not be closed properly.
;(function ($, window, document, undefined) {

    // undefined is used here as the undefined global variable in ECMAScript 3 is
    // mutable (ie. it can be changed by someone else). undefined isn't really being
    // passed in so we can ensure the value of it is truly undefined. In ES5, undefined
    // can no longer be modified.

    // window and document are passed through as local variable rather than global
    // as this (slightly) quickens the resolution process and can be more efficiently
    // minified (especially when both are regularly referenced in your plugin).

    // use strict mode
    "use strict"

    // Create the defaults once
    var pluginVersion = "0.2.0";
    var pluginName = "slidatron";
    var defaults = {
        animationEngine : null, // gsap or jquery / css
        easing          : null,
        slideSelector   : null,
        classNameSpace  : "slidatron",
        holdTime        : 9000,
        transitionTime  : 1500,
        onAfterInit     : null,
        onAfterMove     : null,
        onBeforeInit    : null,
        onBeforeMove    : null,
        autoSlide       : true
    };

    // The actual plugin constructor
    function Plugin(element, options) {

        this.element = element;

        // jQuery has an extend method which merges the contents of two or
        // more objects, storing the result in the first object. The first object
        // is generally empty as we don't want to alter the default options for
        // future instances of the plugin
        this.options = $.extend({}, defaults, options);
        this._defaults = defaults;
        this._name = pluginName;

        if ($('.' + this.options.classNameSpace + '-container').length) {
            var i = 2;
            while ($('.' + this.options.classNameSpace + '-' + i + '-container').length) {
                i++;
            }
            this.options.classNameSpace += '-' + i
        }

        this.init();
    }

    Plugin.prototype = {
        slides: [],
        mapping: {},
        curIndex: 0,
        position: 0,
        slideWrapper: null,
        container: null,
        timeoutHandle: null,
        tweenHandle: null,
        moving: false,
        accelerated: false,
        init: function () {

            // Place initialization logic here
            // You already have access to the DOM element and
            // the options via the instance, e.g. this.element
            // and this.options
            // you can add more functions like the one below and
            // call them like so: this.yourOtherFunction(this.element, this.options).

            // set the scope of some vars
            var options         = this.options;
            var _this           = this;

            // do a quick check to see if we can use translate
            this.accelerated    = this.isAccelerated();

            // run the pre
            if (typeof options.onBeforeInit == 'function') options.onBeforeInit();

            // handle existing html nodes
            var $container      = $(this.element).addClass(options.classNameSpace + '-container').addClass('st-container');
            var $slides         = options.slideSelector ? $container.find(options.slideSelector) : $container.children() ;

            // grab the dims of the container
            var containerW      = $container.width();
            var containerH      = $container.height();

            // new html nodes
            var $slideWrapper   =   $('<div class="' + options.classNameSpace + '-slide-wrapper st-slide-wrapper"></div>').css({
                                        position    : 'absolute',
                                        top         : 0,
                                        left        : 0,
                                        width       : $slides.length * containerW
                                    });
            var $ctrlWrapper    =   $('<div class="' + options.classNameSpace + '-ctrl-wrapper st-ctrl-wrapper"></div>');
            var $next           =   $('<a class="' + options.classNameSpace + '-next st-next">&gt;</a>').on('click', function(e) {
                                        e.preventDefault();
                                        if (!_this.moving) {
                                            var next = (_this.curIndex + 1) > (_this.slides.length - 1) ? 0 : _this.curIndex + 1 ;
                                            _this.stopShow();
                                            _this.move(next);
                                            _this.startShow();
                                        }
                                    });
            var $prev           =   $('<a class="' + options.classNameSpace + '-prev st-prev">&lt;</a>').on('click', function(e) {
                                        e.preventDefault();
                                        if (!_this.moving) {
                                            var prev = (_this.curIndex - 1) < 0 ? (_this.slides.length - 1) : _this.curIndex - 1 ;
                                            _this.stopShow();
                                            _this.move(prev);
                                            _this.startShow();
                                        }
                                    });


            // process slides
            var i = 0;
            $slides.each(function() {

                // get some vars
                var $this       = $(this);

                // this is in here 3 times
                var ids         = _this.generateIndentifiers(i);
                var className   = ids.className;
                var id          = ids.id;
                var ctrlId      = ids.ctrlId;

                // append the class to the elem
                $this.addClass(className+' '+id);

                // add the slide into the slide container
                $slideWrapper.append($this);

                // add a control elem for this slide
                var $ctrlElem = $('<a class="st-ctrl-elem" href="#' + id + '" id="' + ctrlId + '"></a>');
                $ctrlElem.on('click', function (e) {
                    e.preventDefault();
                    if (!_this.moving) {
                        var pieces = $(this).attr('id').split('-');
                        var index = parseInt(pieces[pieces.length-1]);
                        _this.stopShow();
                        _this.move(index);
                        _this.startShow();
                    }
                });
                $ctrlWrapper.append($ctrlElem);

                // cache the elems
                _this.mapping.id = {
                    ctrl    : $ctrlElem,
                    slide   : $this
                };

                // manipulate the styles
                $this.css(_this.cssLeft(i * containerW, {
                    position    : 'absolute',
                    top         : 0,
                    width       : containerW
                }));

                // increment counter
                i++;

            });

            // save these for later
            this.slides = $slides;

            // update the container styles
            $container.css({
                width       : containerW,
                height      : containerH,
                position    : 'relative',
                overflow    : 'hidden'
            });

            // build the dom structure
            $container
                .append($slideWrapper)
                .parent()
                    .append($prev)
                    .append($next)
                    .append($ctrlWrapper);

            // initialise the position
            this.slideWrapper = $slideWrapper;
            this.container = $container;
            this.position = this.curLeft();

            // init block click flag
            var blockClick = false;

            // click handler
            $slideWrapper.find('a').on('click', function(ev){
                if (blockClick) ev.preventDefault();
            });

            // attach the drag event
            $slideWrapper.on('mousedown', function(ev){

                blockClick = false;

                // stop the show once the mouse is pressed
                _this.stopShow();

                // stop the animation
                _this.stopAnimation();

                // save the position
                _this.position = _this.curLeft();

            }).drag(function( ev, dd ){

                // init vars
                var xBlown  = false;
                var yBlown  = false;
                var c       = { x1 : -($slideWrapper.width() - containerW) , x2 : 0 };
                var n       = parseFloat(_this.position) + parseFloat(dd.deltaX);

                // block if we we've blown the containment field
                if (n < c.x1 || n > c.x2) xBlown = true;

                // apply the css
                if (!xBlown) $slideWrapper.css(_this.cssLeft(n));

            }).drag("end",function( ev, dd ){

                // prevent a click from triggering if the delta exceeds the threshold
                blockClick = Math.abs(dd.deltaX) > 5;

                // save the position
                _this.position = _this.curLeft();

                // what are we closest to?
                var cur = _this.curLeft();
                var mod = Math.abs(cur % containerW);
                var mid = Math.abs(containerW / 2);

                // calc some references
                var goNext = mod > mid ? true : false ;
                var index = Math.abs(goNext ? Math.floor(cur/containerW) : Math.ceil(cur/containerW));

                // animate to location
                _this.move(index, undefined, function() { _this.startShow(); });

            }).css({ 'cursor' : 'move' }); // set the cursor to the "move" one


            // resize callback
            $(window).resize(function() {

                // grab the dims of the container
                var containerW = $container.parent().width();

                // set width
                $container.css({ 'width' : containerW });
                $slides.css({ 'width' : containerW });
                $slideWrapper.css({ 'width' : $slides.length * containerW });

                // process slides
                var i = 0;
                $slides.each(function() {

                    // manipulate the styles
                    $(this).css(_this.cssLeft(i * containerW, {width: containerW}));

                    // increment counter
                    i++;

                });

            });

            // start show now that we have finished setting up
            _this.startShow();

            // run the post
            if (typeof options.onAfterInit == 'function') options.onAfterInit();

        },

        easing: function() {

            var supplied = this.options.easing;

            if (this.options.animationEngine == 'gsap') {

                // easing can be anything that is supported by GSAP
                if (typeof supplied == 'object') return supplied;
                return Quad.easeOut;

            } else {

                if (this.accelerated) {

                    // easing is anything supported by CSS transitions
                    var opts = ['ease', 'linear', 'ease-in', 'ease-out', 'ease-in-out', 'step-start', 'step-end'];
                    if (opts.indexOf(supplied) != -1) return supplied;
                    if (/cubic\-bezier\([0-9\., ]+\)/.test(supplied)) return supplied;
                    if (/steps\(.+\)/.test(supplied)) return supplied;
                    return 'ease';

                } else {

                    // easing is anything supported by jquery / plugins
                    if (supplied in jQuery.easing) return supplied;
                    return 'swing';

                }
            }
        },

        cssLeft: function(left, obj) {
            if (obj == undefined) obj = {};
            this.accelerated ? obj['transform'] = 'matrix(1, 0, 0, 1, ' + left  + ', 0)' : obj['left'] = left;
            return obj;
        },

        curLeft: function($elem) {

            var left;

            if ($elem == undefined) $elem = this.slideWrapper;

            if (this.accelerated) {
                left = $elem.css('transform').match(/(-?[0-9\.]+)/g);
                if (left && typeof left == 'object') left = left[4];
            } else {
                left = $elem.position().left;
            }

            if (left == 'none' || !left) left = 0;

            return parseFloat(left);
        },

        supports: function(p) {
            var b = document.body || document.documentElement,
                s = b.style;

            if (typeof s[p] == 'string') { return true; }

            // Tests for vendor specific prop
            var v = ['Moz', 'webkit', 'Webkit', 'Khtml', 'O', 'ms'];
            p = p.charAt(0).toUpperCase() + p.substr(1);

            for (var i=0; i<v.length; i++) {
                if (typeof s[v[i] + p] == 'string') { return true; }
            }

            return false;
        },

        isAccelerated: function() {
            return this.supports('transform') && this.supports('transition');
        },

        generateIndentifiers: function(index) {
            // this is in here 3 times
            var className   = this.options.classNameSpace + '-slide';
            var id          = className + '-' + index;
            var ctrlId      = 'ctrl-' + id;
            return {
                'className' : className,
                'id'        : id,
                'ctrlId'    : ctrlId
            };
        },

        startShow: function() {

            if (this.options.autoSlide) {

                // init the vars
                var _this = this;

                // init the slideshow
                this.stopShow();
                this.timeoutHandle = setInterval(function() {
                    _this.timeoutCallback();
                }, this.options.holdTime);

                // add current to the first index
                if (!$('.' + this.options.classNameSpace + '-ctrl-wrapper a.current').length) {
                    var ids = this.generateIndentifiers(0);
                    $('.' + this.options.classNameSpace + '-ctrl-wrapper a').removeClass('current');
                    $('#' + ids.ctrlId).addClass('current');
                }
            }
        },

        stopShow: function() {
            clearTimeout(this.timeoutHandle);
        },

        stopAnimation: function() {
            if (this.options.animationEngine == 'gsap') {
                if (this.tweenHandle) this.tweenHandle.kill();
            } else {
                if (this.accelerated) {
                    this.slideWrapper
                        .off('transitionend.move webkitTransitionEnd.move oTransitionEnd.move otransitionend.move MSTransitionEnd.move')
                        .css(this.cssLeft(this.curLeft(),{transition: 'transform 0s'}));
                } else {
                    this.slideWrapper.stop();
                }
            }
        },

        timeoutCallback: function() {
            var next = (this.curIndex + 1) > (this.slides.length - 1) ? 0 : this.curIndex + 1 ;
            this.move(next);
        },

        move: function(index, time, cb) {

            var _this           = this;
            var $slideWrapper   = this.slideWrapper;
            var $container      = this.container;
            var target          = -(index * $container.width());
            var next            = (target) > (this.slides.length - 1) ? 0 : target ;
            var callback        = function(){

                _this.moving    = false;
                _this.position  = _this.curLeft();
                _this.curIndex  = index;

                // this is in here 3 times
                var ids = _this.generateIndentifiers(index);
                $('.' + _this.options.classNameSpace + '-ctrl-wrapper a').removeClass('current');
                $('#' + ids.ctrlId).addClass('current');

                // add the curret class to the current slide
                $('.' + _this.options.classNameSpace + '-slide').removeClass('current');
                $('.' + _this.options.classNameSpace + '-slide-' + index).addClass('current');

                // run the post
                if (typeof _this.options.onAfterMove == 'function') _this.options.onAfterMove();

                // run supplied callback - hmmmm - not 100% sure about this
                if (typeof cb == 'function') cb();

            }

            // run the pre callback
            if (typeof _this.options.onBeforeMove == 'function') _this.options.onBeforeMove();

            // set a time
            if (time == undefined) time = this.options.transitionTime;

            // generate the css
            var to = this.cssLeft(next);

            // stop any current animations
            this.stopAnimation();

            // do the animation
            if (this.options.animationEngine == 'gsap') {

                this.tweenHandle = TweenLite.fromTo($slideWrapper[0], time / 1000, {
                    css: this.cssLeft(this.curLeft()),
                },{
                    css: to,
                    ease: this.easing(),
                    onComplete: callback
                });

            } else {

                if (this.accelerated) {
                    $slideWrapper
                        .one('transitionend.move webkitTransitionEnd.move oTransitionEnd.move otransitionend.move MSTransitionEnd.move', callback)
                        .css({transition: 'transform ' + time / 1000 + 's ' + this.easing()})
                        .css(to);
                } else {
                    $slideWrapper.animate(to, time, this.easing(), callback);
                }

            }

            // stores the moving state
            this.moving = true;

        }
    };

    // A really lightweight plugin wrapper around the constructor,
    // preventing against multiple instantiations
    $.fn[pluginName] = function (options) {
        return this.each(function () {
            if (!$.data(this, "plugin_" + pluginName)) {
                $.data(this, "plugin_" + pluginName, new Plugin(this, options));
            }
        });
    };

})(jQuery, window, document);
