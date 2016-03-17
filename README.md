## Usage

### JavaScript

````javascript
$(document).ready(function(){
    $('#container').slidatron()
});
````

### HTML

````html
<div id="container">
    <div>
        I am some html
    </div>
    <div>
        I am some other html
    </div>
</div>
````

For an example see `demo/demo.html`


### Options / Defaults

````json
{
    animationEngine     : null,     // gsap or jquery / css
    easing              : null,
    slideSelector       : null,
    classNameSpace      : 'slidatron',
    holdTime            : 10000,
    transitionTime      : 1000,
    translateY          : false,
    cursor              : 'move',
    drag                : true,     // true / false / 'touch'
    transition          : 'left',   // transition identifier ('left' or 'fade')
    onAfterInit         : null,     // ($elem, this)
    onAfterMove         : null,     // ($elem, this)
    onBeforeInit        : null,     // ($elem, this)
    onBeforeMove        : null,     // ($elem, this)
    autoSlide           : true,
    adaptiveHeight      : false,
    onBeforeAdaptHeight : null,     // ($elem, this)
    onAfterAdaptHeight  : null      // ($elem, this)
    allowDefault        : false
}
````

### Option Details

#### animationEngine

If no animation engine is provided it will preferentially use hardware accelerated CSS to animate if the browser supports it.  If not it will fall back to `jQuery.animate`.

Alternatively you can use GSAP by including `TweenLite` and providing the string `gsap` as the value for the option; gsap will also utilise hardware acceleration if available.

See `demo/demo.html` and `http://greensock.com/` for more information.


#### easing

A number of easing options are supported.

If you are using the gsap engine then options are whatever gsap supports: `http://greensock.com/docs/#/HTML5/GSAP/Easing/`

If you are using default engine then options are whatever `jQuery.animate` supports: `http://api.jquery.com/animate/` and `http://jqueryui.com/easing/`
or whatever CSS supports: `http://css-tricks.com/almanac/properties/t/transition-timing-function/`

*Currently the only engine that will provide consistent easing in older browsers is GSAP.*

This is because the plugin default engine falls back to `jQuery.animate` if the browser does not support css transitions and transforms.
Hence:
- if you provide a CSS option for easing such as `ease-in-out` which is not a support easing type in jQuery it will fall back to `swing`.
- if you provide a jQuery option for easing such as `swing` which is not a supported easing type in CSS it will fall back to `ease`.



#### slideSelector

A css selector if you don't want the plugin to use each immediate child of the container as a slide.


#### classNameSpace

This will prefix all the classes added to the html elements with the given string.  Useful if you have multiple sliders on a page or dont like `slidatron`


#### holdTime

The hold time in ms for each slide


#### transitionTime

How long it takes in ms to move from one slide to the next one


#### translateY

Translate vertical drag to scroll


#### drag

`true` - use drag
`false` - don't use drag
`'touch'` only use drag on touch devices


#### transition

Transition type - `'left'` or `'fade'`


#### onAfterInit

A call back function to run after the plugin has initialised


#### onAfterMove

A call back function to run after a slide has moved


#### onBeforeInit

A call back function to run before the plugin has initialised


#### onBeforeMove

A call back function to run before a slide has moved


#### autoSlide

A boolean value that tells the plugin to start the slideshow once it has initalised


#### adaptiveHeight

A boolean value that tells the plugin to scale based on the height of it's contents when the window resizes


#### allowDefault

Allows the default when using drag - i.e. similar to translate Y, but allows all default actions


## Todo

- Adjust animation timing depening on drop point
- Provide a consistent interface for CSS vs jQuery easing
- Update documentation
- improve destroy behaviour
- fix adaptive height fringe cases
- fix translateY fringe cases

Copyright (c) 2015, Aaron Latham-Ilari
All rights reserved.

## License

Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions are met:

1. Redistributions of source code must retain the above copyright notice, this
   list of conditions and the following disclaimer.
2. Redistributions in binary form must reproduce the above copyright notice,
   this list of conditions and the following disclaimer in the documentation
   and/or other materials provided with the distribution.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT OWNER OR CONTRIBUTORS BE LIABLE FOR
ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
(INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND
ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
(INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.

The views and conclusions contained in the software and documentation are those
of the authors and should not be interpreted as representing official policies,
either expressed or implied, of the FreeBSD Project.
