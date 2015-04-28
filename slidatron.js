/*
 *  Project: Slidatron
 *  Description: A basic slider with drag / touch support
 *  Author: Aaron Latham-Ilari
 *  License: BSD
 */

;(function (root, factory) {

    // AMD. Register as an anonymous module depending on jQuery.
    if (typeof define === 'function' && define.amd) define(['jquery'], factory);

    // Node, CommonJS-like
    else if (typeof exports === 'object') module.exports = factory(require('jquery'));

    // Browser globals (root is window)
    else root.returnExports = factory(root.jQuery);

}(this, function ($, undefined) {

    // use strict mode
    "use strict";

    // Create the defaults once
    var pluginVersion = "0.4.0";
    var pluginName = "slidatron";
    var defaults = {
        animationEngine     : null, // gsap or jquery / css
        easing              : null,
        slideSelector       : null,
        classNameSpace      : "slidatron",
        holdTime            : 9000,
        transitionTime      : 1500,
        translateY          : false,
        drag                : true,
        transition          : 'left', // transition identifier
        onAfterInit         : null, // ($elem, this)
        onAfterMove         : null, // ($elem, this)
        onBeforeInit        : null, // ($elem, this)
        onBeforeMove        : null, // ($elem, this)
        autoSlide           : true,
        adaptiveHeight      : false,
        onBeforeAdaptHeight : null, // ($elem, this)
        onAfterAdaptHeight  : null  // ($elem, this)
    };

    // The actual plugin constructor
    function Plugin(element, options) {

        this.element = element;

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
        styleCache: {},
        mapping: {},
        curIndex: 0,
        position: 0,
        slideWrapper: null,
        container: null,
        timeoutHandle: null,
        tweenHandle: null,
        moving: false,
        accelerated: false,
        $original: null,
        originalHTML: null,
        init: function () {

            //save a copy for later
            this.$original = $(this.element).clone()
            this.originalHTML = $(this.element)[0].outerHTML;

            // set the scope of some vars
            var options         = this.options;
            var _this           = this;

            // do a quick check to see if we can use translate
            this.accelerated    = this.isAccelerated();

            // run the pre
            if (typeof options.onBeforeInit == 'function') options.onBeforeInit($(this.element), this);

            // handle existing html nodes
            var $container      = $(this.element).addClass(options.classNameSpace + '-container').addClass('st-container');
            var $slides         = options.slideSelector ? $container.find(options.slideSelector) : $container.children() ;

            // grab the dims of the container
            var containerW      = $container.width();
            var containerH      = options.adaptiveHeight ? this.maxH($slides, true) : $container.height();

            // stash the styles on the container
            this.setCachedStyle($container);

            // new html nodes
            var $slideWrapper   =   $('<div class="' + options.classNameSpace + '-slide-wrapper st-slide-wrapper"></div>').css({
                                        position    : 'absolute',
                                        top         : 0,
                                        left        : 0,
                                        width       : $slides.length * containerW
                                    });
            var $ctrlWrapper    =   $('<div class="' + options.classNameSpace + '-ctrl-wrapper st-ctrl-wrapper"></div>');
            var $next           =   $('<a class="' + options.classNameSpace + '-next st-next">&gt;</a>').on('tap, click', function(e) {
                                        e.preventDefault();
                                        if (!_this.moving) {
                                            var next = (_this.curIndex + 1) > (_this.slides.length - 1) ? 0 : _this.curIndex + 1 ;
                                            _this.stopShow();
                                            _this.move(next);
                                            _this.startShow();
                                        }
                                    });
            var $prev           =   $('<a class="' + options.classNameSpace + '-prev st-prev">&lt;</a>').on('tap, click', function(e) {
                                        e.preventDefault();
                                        if (!_this.moving) {
                                            var prev = (_this.curIndex - 1) < 0 ? (_this.slides.length - 1) : _this.curIndex - 1 ;
                                            _this.stopShow();
                                            _this.move(prev);
                                            _this.startShow();
                                        }
                                    });

            // stash the max h
            var maxH = this.maxH($slides);

            // process slides
            var i = 0;
            $slides.each(function() {

                // get some vars
                var $this       = $(this);

                // stash the original styles
                _this.setCachedStyle($this);

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
                $ctrlElem.on('tap, click', function (e) {
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
                // $this.css(_this.trans().css(i * containerW, {
                //     position    : 'absolute',
                //     top         : 0,
                //     width       : _this.slideW(containerW, $this),
                // }));

                // increment counter
                i++;

            });

            // adaptive height?
            if (options.adaptiveHeight) $slides.css('height', maxH);

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

            // stash the references to the elems
            this.slideWrapper = $slideWrapper;
            this.container = $container;

            // init the slides for the transition
            this.trans().init();

            // set the current position
            this.position = this.trans().cur();

            // init shared vars for the drag etc
            var blockClick = false,
                $scrollElem,
                refScrollPoint,
                dragEnd = function(index) {

                    // save the position
                    _this.position = _this.trans().cur();

                    // what are we closest to?
                    var cur = _this.trans().cur(),
                        mod = Math.abs(cur % containerW),
                        mid = Math.abs(containerW / 2),
                        max = $slides.length - 1;

                    // calc some references
                    var goNext = mod > mid ? true : false ;
                    if (index == undefined) index = Math.abs(goNext ? Math.floor(cur/containerW) : Math.ceil(cur/containerW));
                    if (index > max) index = max;

                    // animate to location
                    _this.move(index, undefined, function() { _this.startShow(); });

                };


            // drag support
            if (options.drag) {

                // click handler
                $slideWrapper.find('a').on('click', function(ev){
                    if (blockClick) ev.preventDefault();
                });

                // attach the drag event
                $slideWrapper.on('mousedown touchstart', function(ev){

                    // init shared vars
                    blockClick = false;

                    // init shared vars (translate specific)
                    if (options.translateY) {
                        $scrollElem = _this.findScrollingParent($slideWrapper);
                        refScrollPoint = $scrollElem.scrollTop();
                    }

                    // stop the show once the mouse is pressed
                    _this.stopShow();

                    // stop the animation
                    _this.stopAnimation();

                    // save the position
                    _this.position = _this.trans().cur();

                }).drag(function( ev, dd ){

                    // init vars
                    var xBlown  = false;
                    var yBlown  = false;
                    var c       = { x1 : -($slideWrapper.width() - containerW) , x2 : 0 };
                    var n       = parseFloat(_this.position) + parseFloat(dd.deltaX);

                    // translate scroll
                    if (options.translateY) $scrollElem.scrollTop(refScrollPoint - dd.deltaY);

                    // block if we we've blown the containment field
                    if (n < c.x1 || n > c.x2) xBlown = true;

                    // apply the css
                    if (!xBlown) $slideWrapper.css(_this.trans().css(n));

                }).drag("end",function( ev, dd ){

                    // prevent a click from triggering if the delta exceeds the x threshold
                    blockClick = Math.abs(dd.deltaX) > 5;

                    // prevent a click from triggering if the delta exceeds the y threshold
                    if (options.translateY && !blockClick) blockClick = Math.abs(dd.deltaY) > 5;

                    dragEnd();

                }).css({ 'cursor' : 'move' }); // set the cursor to the "move" one

            }

            // resize callback
            $(window).resize(function() {

                // fush the current width from the container so it doesn't fuck our measurement
                _this.stopAnimation();
                $container.css({width: ''});

                // grab the dims of the container
                var containerW = $container.parent().width();

                // adaptive height
                if (options.adaptiveHeight) {
                    if (typeof options.onBeforeAdaptHeight == 'function') options.onBeforeAdaptHeight($(_this.element), _this);

                    // reset
                    $slides.css({height: '', width: ''});
                    $slideWrapper.css({width: '', height: ''});

                    // set width - dupe
                    $container.css({ width: containerW });
                    $slides.each(function() { $(this).css({ width: _this.slideW(containerW, $(this)) }); });
                    $slideWrapper.css({ width: $slides.length * containerW });

                    // measure
                    var outerMaxH = _this.maxH($slides, true);

                    // apply
                    // console.log('fuck: ' + outerMaxH);
                    $slideWrapper.css({height: outerMaxH});
                    $container.css({height: $slideWrapper.outerHeight(true)});

                    // measure
                    // var maxH = _this.maxH($slides);
                    // $slides.css({height: maxH});

                    if (typeof options.onAfterAdaptHeight == 'function') options.onAfterAdaptHeight($(_this.element), _this);
                }
                else {

                    // set width - dupe
                    $container.css({ width: containerW });
                    $slides.each(function() { $(this).css({ width: _this.slideW(containerW, $(this)) }); });
                    $slideWrapper.css({ width: $slides.length * containerW });

                }

                // process slides
                var i = 0;
                $slides.each(function() {

                    // manipulate the styles
                    $(this).css(_this.trans().css(i * containerW, {width: containerW}));

                    // increment counter
                    i++;

                });

                dragEnd(_this.curIndex);

            });

            // start show now that we have finished setting up
            this.startShow();

            // run the post
            if (typeof options.onAfterInit == 'function') options.onAfterInit($(this.element), this);

        },

        hasTouch: function() {
            try {
                document.createEvent("TouchEvent");
                return true;
            } catch (e) {
                return false;
            }
        },

        findScrollingParent: function($elem) {
            var $parent = $elem;
            while ($parent && $parent.css('overflow-y') != 'scroll' && $parent.css('overflow-y') != 'auto' && !$parent.is('body')) {
                $parent = $parent.parent();
            }
            return $parent;
        },

        slideW: function(targetW, $elem) {
            var dif = $elem.outerWidth(true) - $elem.width();
            return targetW - dif;
        },

        slideH: function(targetH, $elem) {
            var dif = $elem.outerHeight(true) - $elem.height();
            return targetH - dif;
        },

        uid: function($elem) {
            var id = $elem.attr('id');
            if (!id) {
                while (!id || $('#' + id).length) {
                    id = Math.floor(Math.random() * 10000) + 1;
                }
                $elem.attr('id', id);
            }
            return id;
        },

        getCachedStyle: function($elem) {
            var uid = this.uid($elem);
            return this.styleCache[uid];
        },

        setCachedStyle: function($elem) {
            var uid = this.uid($elem);
            this.styleCache[uid] = $elem.attr('style');
            return this;
        },

        reApplyCachedStyle: function($elem) {
            $elem.attr('style', this.getCachedStyle($elem));
            return this;
        },

        maxH: function($set, outer) {

            var h = 0, hTmp = 0;

            $set.each(function() {

                var $this = $(this);

                //hTmp = outer != undefined && outer ? $this.outerHeight(true): $this.height();

                if (outer != undefined && outer) hTmp = $this.outerHeight(true);
                else hTmp = $this.height();

                // console.log(hTmp + ' v ' + $this.outerHeight(true) );

                if (h < hTmp) h = hTmp;
            });

            return h;
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

        // we need to use call or something similar to bind the value of this
        // in these transition funcs so they can be defined externally
        trans: function() {
            var _this = this,
                trans = {
                    left: {
                        init: function() {

                            var i = 0,
                                containerW = _this.container.width();

                            _this.slides.each(function() {

                                var $this = $(this);

                                // manipulate the styles
                                $this.css(_this.trans().css(i * containerW, {
                                    position    : 'absolute',
                                    top         : 0,
                                    width       : _this.slideW(containerW, $this),
                                }));

                                // increment counter
                                i++;

                            });
                        },
                        isSame: function(to, $elem) {

                            var left;

                            if (_this.accelerated) {
                                left = to['transform'].match(/(-?[0-9\.]+)/g);
                                if (left && typeof left == 'object') left = left[4];
                            } else {
                                left = to['left'];
                            }

                            return left == _this.trans().cur($elem);

                        },
                        css: function(left, obj) {
                            if (obj == undefined) obj = {};
                            _this.accelerated ? obj['transform'] = 'matrix(1, 0, 0, 1, ' + left  + ', 0)' : obj['left'] = left;
                            return obj;
                        },
                        cur: function($elem) {

                            var left;

                            if ($elem == undefined) $elem = _this.slideWrapper;

                            if (_this.accelerated) {
                                left = $elem.css('transform').match(/(-?[0-9\.]+)/g);
                                if (left && typeof left == 'object') left = left[4];
                            } else {
                                left = $elem.position().left;
                            }

                            if (left == 'none' || !left) left = 0;

                            return parseFloat(left);
                        }
                    },
                    opacity: {
                        init: function() {

                            var i = 0,
                                containerW = _this.container.width();

                            _this.slides.each(function() {

                                var $this = $(this);

                                // manipulate the styles
                                $this.css(_this.trans().css((i == 0 ? 1 : 0), {
                                    position    : 'absolute',
                                    top         : 0,
                                    left        : 0,
                                    width       : _this.slideW(containerW, $this),
                                }));

                                // increment counter
                                i++;

                            });
                        },
                        isSame: function(to, $elem) {
                            var val = to['opacity'];
                            return val == _this.trans().cur($elem);
                        },
                        css: function(val, obj) {
                            if (obj == undefined) obj = {};
                            obj['opacity'] = val;
                            obj['z-index'] = val;
                            return obj;
                        },
                        cur: function($elem) {
                            var val;
                            if ($elem == undefined) $elem = _this.slideWrapper;
                            val = $elem.css('opacity');
                            if (val == 'none' || !val) val = 0;
                            return parseFloat(val);
                        }
                    }
                };
            return trans[this.options.transition];
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
                        .css(this.trans().css(this.trans().cur(),{transition: 'transform 0s'}));
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
                _this.position  = _this.trans().cur();
                _this.curIndex  = index;

                // this is in here 3 times
                var ids = _this.generateIndentifiers(index);
                $('.' + _this.options.classNameSpace + '-ctrl-wrapper a').removeClass('current');
                $('#' + ids.ctrlId).addClass('current');

                // add the curret class to the current slide
                $('.' + _this.options.classNameSpace + '-slide').removeClass('current');
                $('.' + _this.options.classNameSpace + '-slide-' + index).addClass('current');

                // run the post
                if (typeof _this.options.onAfterMove == 'function') _this.options.onAfterMove($(_this.element), _this);

                // run supplied callback - hmmmm - not 100% sure about this
                if (typeof cb == 'function') cb();

            }

            // run the pre callback
            if (typeof this.options.onBeforeMove == 'function') this.options.onBeforeMove($(this.element), this);

            // set a time
            if (time == undefined) time = this.options.transitionTime;

            // generate the css
            var to = this.trans().css(next);

            // stop any current animations
            this.stopAnimation();

            // do the animation
            if (this.options.animationEngine == 'gsap') {

                this.tweenHandle = TweenLite.fromTo($slideWrapper[0], time / 1000, {
                    css: this.trans().css(this.trans().cur()),
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

            // same? - then set moving to false as transition wont run
            if (this.accelerated && this.options.animationEngine != 'gsap' && this.trans().isSame(to, $slideWrapper)) {
                this.moving = false;
            }

        },

        destroy: function() {
            var $replacement = $(this.originalHTML);
            this.slideWrapper.after($replacement);
            this.slideWrapper.remove();
            $('.' + this.options.classNameSpace + '-container').remove();
            $('.' + this.options.classNameSpace + '-ctrl-wrapper').remove();
            $('.' + this.options.classNameSpace + '-next').remove();
            $('.' + this.options.classNameSpace + '-prev').remove();
            return $replacement;
        }
    };

    // A really lightweight plugin wrapper around the constructor,
    // preventing against multiple instantiations
    $.fn[pluginName] = function(options) {
        var self = this;
        return this.each(function (idx) {
            if (!$.data(this, "plugin_" + pluginName)) {
                $.data(this, "plugin_" + pluginName, new Plugin(this, options));
            } else {
                if (options == 'destroy'){

                    var plugin = $.data(this, "plugin_" + pluginName);
                    var destroyed = plugin.destroy();

                    if (destroyed != undefined) self[idx] = destroyed[0];
                    if (plugin) plugin = null;

                    $.data(this, "plugin_" + pluginName, null);

                }
            }
        });
    };

}));
