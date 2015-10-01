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
    var pluginVersion = "0.4.9";
    var pluginName = "slidatron";
    var defaults = {
        animationEngine     : null,     // gsap or jquery / css
        easing              : null,
        slideSelector       : null,
        classNameSpace      : 'slidatron',
        holdTime            : 10000,
        transitionTime      : 1000,
        translateY          : false,
        cursor              : 'move',
        drag                : true,     // true / false / 'touch'
        transition          : 'left',   // transition identifier - left / opacity
        transitionModifier  : null,     // currently only works with left to disable transform
        onAfterInit         : null,     // ($elem, this)
        onAfterMove         : null,     // ($elem, this)
        onBeforeInit        : null,     // ($elem, this)
        onBeforeMove        : null,     // ($elem, this)
        autoSlide           : true,
        adaptiveHeight      : false,
        onBeforeAdaptHeight : null,     // ($elem, this)
        onAfterAdaptHeight  : null      // ($elem, this)
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
        tweenHandle: {},
        moving: false,
        accelerated: false,
        $original: null,
        originalHTML: null,
        dragFrom: null,
        dragTo: null,
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
                                        left        : 0
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

                    // Im not sure this is necessary
                    // var max = $slides.length - 1;

                    // get stuff
                    var fromIndex = undefined,
                        $fromElem = _this.trans().dragFromElem() || [null],
                        $curElem  = _this.trans().curElem() || [null];

                    // calc some references
                    if (index == undefined) index = _this.trans().calcDragEndIndex();
                    // if (index > max) index = max;

                    // is what we are dragging from not the current elem?
                    if ($fromElem[0] != $curElem[0])
                        fromIndex = _this.slides.index($fromElem);

                    // console.log('from:' + fromIndex + ' to:' + index + ' pos:' + _this.position) ;

                    // animate to location
                    _this.move(index, fromIndex, undefined, function() { _this.startShow(); });

                };


            // drag support
            if (options.drag === true || (options.drag == 'touch' && this.hasTouch())) {

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

                }).on('mouseup touchend', function(ev){

                    dragEnd();

                }).drag(function( ev, dd ){

                    // translate scroll
                    if (options.translateY) $scrollElem.scrollTop(refScrollPoint - dd.deltaY);

                    // handle the drag
                    _this.trans().dragHandler(dd.deltaX);

                }).drag("end",function( ev, dd ){

                    // prevent a click from triggering if the delta exceeds the x threshold
                    blockClick = Math.abs(dd.deltaX) > 5;

                    // prevent a click from triggering if the delta exceeds the y threshold
                    if (options.translateY && !blockClick) blockClick = Math.abs(dd.deltaY) > 5;

                    dragEnd();

                }).css({ 'cursor' : this.options.cursor }); // set the cursor to the "move" one

            }

            // resize callback
            $(window).on('resize.slidatron', function() {

                // fush the current width from the container so it doesn't fuck our measurement
                _this.stopAnimation();
                $container.css({width: ''});

                // grab the dims of the container
                var containerW = $container.parent().width();

                // adaptive height
                if (options.adaptiveHeight) {

                    // callback
                    if (typeof options.onBeforeAdaptHeight == 'function') options.onBeforeAdaptHeight($(_this.element), _this);

                    // reset
                    $slides.css({height: '', width: ''});
                    $slideWrapper.css({width: '', height: ''});

                    // fire resize handler
                    _this.trans().resizeHandler();

                    // measure
                    var outerMaxH = _this.maxH($slides, true);

                    // apply
                    $slideWrapper.css({height: outerMaxH});
                    $container.css({height: $slideWrapper.outerHeight(true)});

                    // callback
                    if (typeof options.onAfterAdaptHeight == 'function') options.onAfterAdaptHeight($(_this.element), _this);
                }
                else {

                    // fire resize handler
                    _this.trans().resizeHandler();

                }

                // process slides
                _this.trans().resizeSlideHandler();

                // trigger the drag end bizzo
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
            return $parent.is('body') ? $('html, body') : $parent;
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

                            _this.slideWrapper.width(_this.slides.length * containerW);

                        },
                        resizeHandler: function() {
                            var containerW = _this.container.parent().width();
                            _this.container.css({ width: containerW });
                            _this.slides.each(function() { $(this).css({ width: _this.slideW(containerW, $(this)) }); });
                            _this.slideWrapper.css({ width: _this.slides.length * containerW });
                        },
                        resizeSlideHandler: function() {

                            var i = 0,
                                containerW = _this.container.parent().width();

                            _this.slides.each(function() {

                                // manipulate the styles
                                $(this).css(_this.trans().css(i * containerW, {width: containerW}));

                                // increment counter
                                i++;

                            });
                        },
                        dragHandler: function(delta) {

                            var xBlown = false,
                                c      = { x1 : -(_this.slideWrapper.width() - _this.container.width()) , x2 : 0 },
                                n      = parseFloat(_this.position) + parseFloat(delta);

                            // block if we we've blown the containment field
                            if (n < c.x1 || n > c.x2) xBlown = true;

                            // apply the css
                            if (!xBlown) _this.slideWrapper.css(_this.trans().css(n));

                        },
                        calcDragEndIndex: function() {

                            // what are we closest to?
                            var cur = _this.trans().cur(),
                                containerW = _this.container.width(),
                                mod = Math.abs(cur % containerW),
                                mid = Math.abs(containerW / 2),
                                max = _this.slides.length - 1;

                            // calc some references
                            var goNext = mod > mid ? true : false ;
                            var index = Math.abs(goNext ? Math.floor(cur/containerW) : Math.ceil(cur/containerW));
                            if (index > max) index = max;

                            return index;

                        },
                        getStateForNext: function(index) {
                            var target = -(index * _this.container.width());
                            var next   = target > (_this.slides.length - 1) ? 0 : target;
                            return next;
                        },
                        getStateForPrev: function(index) {
                            return false;
                        },
                        transitionProp: function() {
                            return _this.accelerated ? 'transform' : 'left';
                        },
                        dragFromElem: function() {
                            return _this.slideWrapper;
                        },
                        dragToElem: function() {
                            return _this.slideWrapper;
                        },
                        getElemAt: function(index) {
                            return _this.slideWrapper;
                        },
                        nextElem: function() {
                            return _this.slideWrapper;
                        },
                        curElem: function() {
                            return _this.slideWrapper;
                        },
                        prevElem: function() {
                            return _this.slideWrapper;
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
                            if (!$elem.length) return 0;

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

                            _this.slideWrapper.width( containerW);

                        },
                        resizeHandler: function() {
                            var containerW = _this.container.parent().width();
                            _this.container.css({ width: containerW });
                            _this.slides.each(function() { $(this).css({ width: _this.slideW(containerW, $(this)) }); });
                        },
                        resizeSlideHandler: function() {
                            // nothing to do
                        },
                        dragHandler: function(delta) {

                            var $cur  = _this.trans().curElem(),
                                $prev = _this.trans().prevElem(),
                                $next = _this.trans().nextElem(),
                                width = _this.container.width(),
                                delta = (parseFloat(delta) / parseFloat(width)),
                                val   = Math.abs(delta + (1 - _this.position)),
                                val   = val > 1 ? 1 : val,
                                val   = val < 0 ? 0 : val;

                            // console.log(delta + ' | ' + val + ' | '  + _this.position + ' | ' + _this.slides.index(_this.trans().curElem()));

                            // next
                            if (delta < 0) {

                                // such problems when _this.position = 1
                                $next.css(_this.trans().css(val));
                                $cur.css(_this.trans().css(1 - val));

                                if ($prev[0] != $next[0]) $prev.css(_this.trans().css(0));

                                _this.dragFrom = val < 0.5 ? $next : $cur;
                                _this.dragTo = val < 0.5 ? $cur : $next;

                            } else {

                                $prev.css(_this.trans().css(val));
                                $cur.css(_this.trans().css(1 - val));

                                if ($prev[0] != $next[0]) $next.css(_this.trans().css(0));

                                _this.dragFrom = val < 0.5 ? $prev : $cur;
                                _this.dragTo = val < 0.5 ? $cur : $prev;
                            }

                        },
                        calcDragEndIndex: function() {

                            // what are we closest to?
                            var $cur  = _this.trans().curElem(),
                                cur   = _this.trans().cur($cur),
                                $prev = _this.trans().prevElem(),
                                prev  = _this.trans().cur($prev),
                                $next = _this.trans().nextElem(),
                                next  = _this.trans().cur($next),
                                to = undefined;

                            // >= in the later 2 cases gets around the cases where next and prev are the same elem
                            if (cur > prev && cur > next)   to = _this.slides.index($cur);
                            if (prev > cur && prev >= next) to = _this.slides.index($prev);
                            if (next > cur && next >= prev) to = _this.slides.index($next);
                            if (to === undefined)           to = _this.slides.index($cur);

                            return to;

                        },
                        isSame: function(to, $elem) {
                            var val = to['opacity'];
                            return val == _this.trans().cur($elem);
                        },
                        getStateForNext: function(index) {
                            return 1;
                        },
                        getStateForPrev: function(index) {
                            return 0;
                        },
                        transitionProp: function() {
                            return 'opacity';
                        },
                        getElemAt: function(index) {
                            return $(_this.slides[index]);
                        },
                        dragFromElem: function() {
                            return _this.dragFrom;
                        },
                        dragToElem: function() {
                            return _this.dragTo;
                        },
                        nextElem: function() {
                            var $next = _this.trans().curElem().next();
                            if (!$next.length) $next = _this.slides.first()
                            return $next;
                        },
                        curElem: function(noDragFrom) {
                            var $cur = _this.slides.filter('.current');
                            if (!$cur.length) $cur = _this.slides.first();
                            return $cur;
                        },
                        prevElem: function(noDragTo) {
                            var $prev = _this.trans().curElem().prev();
                            if (!$prev.length) $prev = _this.slides.last();
                            return $prev;
                        },
                        css: function(val, obj) {
                            if (obj == undefined) obj = {};
                            obj['opacity'] = val;
                            obj['z-index'] = val;
                            return obj;
                        },
                        cur: function($elem) {
                            var val;
                            if ($elem == undefined) $elem = _this.trans().curElem()
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
            return this.supports('transform') && this.supports('transition') && this.options.transitionModifier.toLowerCase() != 'no_transform';
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

            }

            // add current to the first index
            if (!$('.' + this.options.classNameSpace + '-ctrl-wrapper a.current').length) {
                var ids = this.generateIndentifiers(0);
                $('.' + this.options.classNameSpace + '-ctrl-wrapper a').removeClass('current');
                $('#' + ids.ctrlId).addClass('current');
            }
        },

        stopShow: function() {
            clearTimeout(this.timeoutHandle);
        },

        stopAnimation: function(id) {

            var anis = id != undefined ? {id: id} : this.tweenHandle;

            for (var i in anis) {
                var handle = this.tweenHandle[i];
                    if (handle) {
                    if (this.options.animationEngine == 'gsap') {
                        if (handle != undefined) handle.kill();
                    } else {
                        if (this.accelerated) {
                            // this is a bit weird - we prob need a register of elems animating
                            handle
                                .off('transitionend.move webkitTransitionEnd.move oTransitionEnd.move otransitionend.move MSTransitionEnd.move')
                                .css(this.trans().css(this.trans().cur(handle),{transition: this.trans().transitionProp() + ' 0s'}));
                        } else {
                            handle
                                .stop();
                        }
                    }
                }
            }
        },

        timeoutCallback: function() {
            var next = (this.curIndex + 1) > (this.slides.length - 1) ? 0 : this.curIndex + 1 ;
            this.move(next);
        },

        move: function(indexTo, indexFrom, time, cb) {

            if (indexFrom == undefined) indexFrom = this.curIndex;

            var _this           = this,
                $curElem        = indexFrom == undefined ? this.trans().curElem() : this.trans().getElemAt(indexFrom),
                $nextElem       = this.trans().getElemAt(indexTo),
                $container      = this.container,
                next            = this.trans().getStateForNext(indexTo),
                prev            = this.trans().getStateForPrev(indexTo),
                ns              = this.options.classNameSpace,
                callback        = function(){

                    // update state
                    _this.moving    = false;
                    _this.position  = _this.trans().cur();
                    _this.curIndex  = indexTo;

                    // remove all transitioning classes from the slides
                    _this.slides
                        .removeClass(ns + '-transitioning-to')
                        .removeClass(ns + '-transitioning-from')

                    // remove all transitioning classes from the control elems
                    $('.' + ns + '-ctrl-wrapper a')
                        .removeClass(ns + '-transitioning-to')
                        .removeClass(ns + '-transitioning-from')

                    // this is in here 3 times
                    var ids = _this.generateIndentifiers(indexTo);
                    $('.' + ns + '-ctrl-wrapper a').removeClass('current');
                    $('#' + ids.ctrlId).addClass('current');

                    // add the curret class to the current slide
                    $('.' + ns + '-slide').removeClass('current');
                    $('.' + ns + '-slide-' + indexTo).addClass('current');

                    // run the post
                    if (typeof _this.options.onAfterMove == 'function') _this.options.onAfterMove($(_this.element), _this);

                    // run supplied callback - hmmmm - not 100% sure about this
                    if (typeof cb == 'function') cb();

                };

            // run the pre callback
            if (typeof this.options.onBeforeMove == 'function') this.options.onBeforeMove($(this.element), this);

            // set a time
            if (time == undefined) time = this.options.transitionTime;

            // generate the css
            var to = this.trans().css(next);

            // animate to on state
            if (next!==false) {

                // do animation
                this.doAnimation($nextElem, this.trans().css(next), 'next', time, callback);

            }

            // animate to off state
            if (prev!==false && $nextElem[0] != $curElem[0]) {

                // do animation
                this.doAnimation($curElem, this.trans().css(prev), 'prev', time, callback);
            }

            if (indexFrom != indexTo) {

                // add classes to slides indicate intent
                var $nEl = $(this.slides[indexTo]);
                if ($nEl.length) $nEl.addClass(ns + '-transitioning-to');

                // add classes to control elems to indicate intent
                var nids = _this.generateIndentifiers(indexTo);
                $('#' + nids.ctrlId).addClass(ns + '-transitioning-to');

                // add classes to slides indicate intent
                var $pEl = $(this.slides[indexFrom]);
                if ($pEl.length) $pEl.addClass(ns + '-transitioning-from');

                // add classes to control elems to indicate intent
                var pids = _this.generateIndentifiers(indexFrom);
                $('#' + pids.ctrlId).addClass(ns + '-transitioning-from');
            }

        },

        doAnimation: function($elem, to, id, time, callback) {

            // stop any current animations
            this.stopAnimation(id);

            // do the animation
            if (this.options.animationEngine == 'gsap') {

                this.tweenHandle[id] = TweenLite.fromTo($elem[0], time / 1000, {
                    css: this.trans().css(this.trans().cur()),
                },{
                    css: to,
                    ease: this.easing(),
                    onComplete: callback
                });

            } else {

                if (this.accelerated) {

                    $elem
                        .one('transitionend.move webkitTransitionEnd.move oTransitionEnd.move otransitionend.move MSTransitionEnd.move', callback)
                        .css({transition: this.trans().transitionProp() + ' ' + time / 1000 + 's ' + this.easing()})
                        .css(to);

                } else {
                    $elem.animate(to, time, this.easing(), callback);
                }

                this.tweenHandle[id] = $elem;

            }

            // stores the moving state
            // this might get wierd with multiple animations
            this.moving = true;

            // same? - then set moving to false as transition wont run
            if (this.accelerated && this.options.animationEngine != 'gsap' && this.trans().isSame(to, $elem)) {
                this.moving = false;
                callback(); // hmm
            }
        },

        destroy: function() {
            var $replacement = $(this.originalHTML);
            this.stopShow();
            this.stopAnimation();
            this.slideWrapper.after($replacement);
            this.slideWrapper.remove();
            $(window).off('resize.slidatron');
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
