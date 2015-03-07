requirejs.config({
    "baseUrl": "/",
    "paths": {
		"app": "/demo/js/app",
		"jquery": "https://code.jquery.com/jquery-1.11.1.min",
		"drag": "https://rawgit.com/GerHobbelt/jquery.threedubmedia/master/event.drag/jquery.event.drag"
    }
});

// Load the main app module to start the app
requirejs(["demo/js/app/main"]);