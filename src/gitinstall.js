#!/usr/bin/env node
'use strict';

var Git = require("nodegit");
var gitCredentialHelper = require('git-credential-helper');
var exec = require('child_process').exec;
var fs = require('fs');
var path = require('path');

function copyFileSync( source, target ) {
    var targetFile = target;
    if ( fs.existsSync( target ) ) {  //if target is a directory a new file with the same name will be created
        if ( fs.lstatSync( target ).isDirectory() ) {
            targetFile = path.join( target, path.basename( source ) );
        }
    }
    fs.writeFileSync(targetFile, fs.readFileSync(source));
}

function copyFolderRecursiveSync( source, target , createFolder ) {	
    var files = [];
	
	 
	
	var targetFolder = null;
	if( !createFolder ){ 
		targetFolder = target;
	}else { 
	
		targetFolder = path.join( target, path.basename( source ) );
		if ( !fs.existsSync( targetFolder ) ) {
			fs.mkdirSync( targetFolder );
		} 	
	
	
	}
	


    //copy
    if ( fs.lstatSync( source ).isDirectory() ) {
        files = fs.readdirSync( source );
        files.forEach( function ( file ) {
            var curSource = path.join( source, file );
            if ( fs.lstatSync( curSource ).isDirectory() ) {
                copyFolderRecursiveSync( curSource, targetFolder, true );
            } else {
                copyFileSync( curSource, targetFolder );
            }
        } );
    }
}

function deleteFile(dir, file) {
    return new Promise(function (resolve, reject) {
        var filePath = path.join(dir, file);
        fs.lstat(filePath, function (err, stats) {
            if (err) {
                return reject(err);
            }
            if (stats.isDirectory()) {
                resolve(deleteDirectory(filePath));
            } else {
                fs.unlink(filePath, function (err) {
                    if (err) {
                        return reject(err);
                    }
                    resolve();
                });
            }
        });
    });
};

function deleteDirectory(dir) {
    return new Promise(function (resolve, reject) {
        fs.access(dir, function (err) {
            if (err) {
                return reject(err);
            }
            fs.readdir(dir, function (err, files) {
                if (err) {
                    return reject(err);
                }
                Promise.all(files.map(function (file) {
                    return deleteFile(dir, file);
                })).then(function () {
                    fs.rmdir(dir, function (err) {
                        if (err) {
                            return reject(err);
                        }
                        resolve();
                    });
                }).catch(reject);
            });
        });
    });
};


function execPromise(command, options ) {
    return new Promise(function(resolve, reject) {
		
		var proc = exec( command, options );

		var listOut = [];
		var listErr = [];
		proc.stdout.setEncoding('utf8');

		proc.stdout.on('data', function (chunk) {
			listOut.push(chunk);
			console.log( chunk );
		});

		proc.stdout.on('end', function () {
			console.log(listOut.join());
		});		
		
		proc.stderr.on('data', function (chunk) {
			listErr.push(chunk);
			console.log( chunk );
		});

		proc.stderr.on('end', function () {
			console.log(listErr.join());
		});			
		
		
		proc.on('exit', function() {
			proc.stdout.removeAllListeners("data");
			proc.stderr.removeAllListeners("data")
			resolve( listOut.join() );
		})		
 
    });
}

function askLogin() { 

	return new Promise(function(resolve, reject) {
		console.log("git user name:");
		var stdin = process.openStdin();
		var loginSet = false;
		var login=null;
		var password=null;
		stdin.addListener("data", function(d) {
			if( !loginSet ){ 
				login=d.toString().trim();
				console.log("git password:");
				loginSet=true;
			}
			else{ 
				password=d.toString().trim();
				resolve( { 'login': login, 'password': password } );
			}	
	 
		}); 
  
	});


}


function randomInt (low, high) {
    return Math.floor(Math.random() * (high - low) + low);
}


function cloneProcess( url, folderName, dstFolder, scriptName, cloneOpts ){  

	return new Promise(function(resolve, reject) {
		
		
			var tmpFolderName = "tmp"+randomInt(0,10000);
			Git.Clone( url, "./"+tmpFolderName , cloneOpts )
			.then( function(repo) { 
			
				var currentPath = process.cwd();
				console.log( "current path: " + currentPath );
				copyFolderRecursiveSync( currentPath + "/"+tmpFolderName+"/",  dstFolder, folderName != null );
				
				if( folderName != null )
					fs.renameSync( dstFolder  + tmpFolderName  ,  dstFolder  + folderName );
				
				deleteDirectory( currentPath + "/"+tmpFolderName+"/" ).then( function() { 
				
				
							if( scriptName != null ) {
			 
									console.log( "npm install ..." );
									execPromise( 'npm install', {cwd: dstFolder+folderName} ).then(function( res ) { 
									
										
											console.log( res );

											console.log( "building project..." );
											execPromise( 'npm run '+ scriptName, {cwd: dstFolder+folderName} ).then(function( res ) { 

												console.log( res );
												//console.log( "project build !" );

												resolve( repo );

											}).catch( function(err) { console.log(err); reject(err); } );
			 
									
									}).catch( function(err) { console.log(err); reject(err); } );
									
							}else { 
								resolve( repo );
							}		
						
 
				});				
 
			})
			.catch( function( err ) { console.log(err);  reject( err ) });

	});

}
 
 
function gitInstall( url, folderName, dstFolder, scriptName, branchName ) { 
 
	return new Promise(function(resolve, reject) {
		 gitCredentialHelper.fill( url, function (err, data) {
			 
			// 	//console.log(data);
			// data will contain any stored credentials, or will be {} 
			
			var cloneOpts = null;
			if( data.hasOwnProperty('username') && data.hasOwnProperty('password') ){ 
			
				
				if( data.username == "Personal Access Token" ) { // github ?
					console.log( "cloning via personal access token: " + url );
					cloneOpts = {
					  fetchOpts: {
						callbacks: {
						  credentials: function(url, userName) {
							return Git.Cred.userpassPlaintextNew( data.password, "x-oauth-basic");
						  }
						}
					  }
					};	

					if( branchName != null ) cloneOpts.checkoutBranch = branchName;
				
				
				}else{ 
					console.log( "cloning: " + url );
					cloneOpts = {
					  fetchOpts: {
						callbacks: {
						  credentials: function(url, userName) {
							return Git.Cred.userpassPlaintextNew( data.username, data.password );
						  }
						}
					  }
					};	

					if( branchName != null ) cloneOpts.checkoutBranch = branchName;
				
				
				
				} 
				
				cloneProcess( url, folderName, dstFolder, scriptName, cloneOpts ).then( function( repo ) {
					resolve( repo );
				});
 
			}else { // no creadentials stored
			
				askLogin().then( function ( result ) { 
				
					cloneOpts = {
					  fetchOpts: {
						callbacks: {
						  credentials: function(url, userName) {
							return Git.Cred.userpassPlaintextNew( data.login, data.password );
						  }
						}
					  }
					};	

					if( branchName != null ) cloneOpts.checkoutBranch = branchName;					
				
				
					cloneProcess( url, folderName, dstFolder, scriptName, cloneOpts ).then( function( repo ){
							resolve( repo );
					});
				})
 
			}

		}, { silent: true });		
 
		
	});
 
 
 
 }
 



module.exports = gitInstall;
