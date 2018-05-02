
var gitInstall = require("gitinstall");


var url = "https://github.com/PerspectivesLab/kotibe-npm.git";
var folderName = "kotibe-npm";
var dstFolder = "./node_modules";


gitInstall( url, folderName, dstFolder ).then( function( repo ){ 

	console.log( "All done !" );
			
 
			
})
.catch( function ( err ){ console.log( err );  } );