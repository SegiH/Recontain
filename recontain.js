// warning about config script not found when compiling with pkg
const commandExists = require("command-exists");
const cp = require('child_process');
const fs = require('fs');
const inquirer = require("inquirer");
const os = require('os');
const path = require("path");
const { spawnSync } = require('child_process');
const defaultRulesFile="recontain.json";
const delimiter = os.platform() === "win32" ? "\\" : "/";

const isScript=path.basename(__filename).endsWith(".js");
process.env.NODE_CONFIG_DIR = (isScript ? __dirname : "/snapshot") + delimiter + "config";
const config = require("config");

const demoMode = false;
const usePodman=(config.has("UsePodman") && config.get("UsePodman") === true ? true : false);
const executable = !usePodman ? "docker" : "podman";
const goBack="Go Back";

const readline = require('readline-sync');

const recontainMenuMap = {
     "Main Menu": {
          "Method": promptMainMenu,
          "MenuOptions": {
               "Containers": {
                    "Method": promptSelectContainer,
                    "NextAction": "SelectContainerAction",
                    "PreviousAction": "Main Menu",
                    "SelectContainerAction": {
                         "Method": promptSelectContainerAction,
					"PreviousAction": "Main Menu",
                         "MenuOptions": {
                              "Start Container": {
                                   "NextAction": "ContainerAction",
                                   "PreviousAction": "Containers",
                                   "ActionCommand": "start",
                                   "ActionCommandPastTense": "started"
                              },
                              "Stop Container": {
                                   "NextAction": "ContainerAction",
                                   "PreviousAction": "Containers",
                                   "ActionCommand": "stop",
                                   "ActionCommandPastTense": "stopped"
                              },
                              "Restart Container": {
                                   "NextAction": "ContainerAction",
                                   "PreviousAction": "Select Container Action",
                                   "ActionCommand": "restart",
                                   "ActionCommandPastTense": "restarted"
                              },
                              "Delete Container": {
                                   "NextAction": "ConfirmDeleteAction",
                                   "PreviousAction": "Select Container Action",
                                   "ActionCommand": "rm",
                                   "ActionCommandPastTense": "removed"
                              }
                         },
                         "ConfirmDeleteAction": {
                              "Method": promptConfirm,
                              "NextAction": "Main Menu",
		                    "PromptMessage": "Are you sure that you want to delete <containerName> ?",
                              "PromptOnConfirm": deleteContainer,
		                    "PromptOnDeny": promptSelectContainer,
                         },
                         "ContainerAction": {
                              "Method": runContainerAction,
                              "PreviousAction": "Containers",
                              "NextAction": "Containers"
                         }
                    }
               },
               "Compose Files": {
                    "Method": promptComposeFiles,
                    "NextAction": "SelectComposeFileAction",
                    "PreviousAction": "Main Menu",
                    "SelectComposeFileAction": {
                         "Method": promptSelectComposeFileAction,
                         "NextAction": "Main Menu",
                         "PreviousAction": "Compose Files",
                         "MenuOptions": {
                              "Build": {
                                   "NextAction": "BuildAction"
                              },
                              "Change permissions": {
                                   "NextAction": "ChangePermissionsAction"
                              },
                              "Edit file": {
                                   "NextAction": "EditFileAction"
                              },
                              "Rename File": {
                                   "NextAction": "RenameFileAction"
                              }
                         },
                         "BuildAction": {
                              "Method": buildComposeFile,
                              "NextAction": "Main Menu",
                              "PreviousAction": "SelectComposeFileAction"
                         },
                         "ChangePermissionsAction": {
                              "Method": changeFilePermission,
                              "NextAction": "Main Menu",
                              "PreviousAction": "SelectComposeFileAction"
                         },
                         "EditFileAction": {
                              "Method": editFile,
                              "NextAction": "Main Menu",
                              "PreviousAction": "SelectComposeFileAction"
                         },
                         "RenameFileAction": {
                              "Method": renameFile,
                              "NextAction": "Main Menu",
                              "PreviousAction": "SelectComposeFileAction"
                         }
                    }
               },
               "Images": {
                    "Method": promptSelectImageAction,                    
                    "PreviousAction": "Main Menu",
                    "MenuOptions": {
                         "Inspect an image": {
                              "PreviousAction": "Images",
                              "NextAction": "InspectImageAction"
                         },
                         "Prune unused images": {
                              "PreviousAction": "Images",
                              "NextAction": "PruneImageAction"
                         },
                         "Remove an image": {
                              "PreviousAction": "Images",
                              "NextAction": "RemoveImageAction"
                         },
                         "Update an image": {
                              "PreviousAction": "Images",
                              "NextAction": "UpdateImageAction"
                         }
                    },
                    "InspectImageAction": {
                         "Method": promptSelectImage,
                         "NextAction": "ExecuteShellCommand",
                         "PreviousAction": "Images",
                         "ExecuteShellCommand": {
                              "Method": executeShellCommand,
                              "ActionCommand": "inspect",
                              "NextAction": "Main Menu"
                         }
                    },
                    "PruneImageAction": {
                         "Method": executeShellCommand,
                         "NextAction": "Images"
                    },
                    "RemoveImageAction": {
                         "Method": promptSelectImage,
                         "NextAction": "ExecuteShellCommand",
                         "PreviousAction": "Images",
                         "ExecuteShellCommand": {
                              "Method": executeShellCommand,
                              "ActionCommand": "rm",
                              "NextAction": "Main Menu"
                         }
                    },
                    "UpdateImageAction": {
                         "Method": promptSelectImage,
                         "NextAction": "ExecuteShellCommand",
                         "PreviousAction": "Images",
                         "ExecuteShellCommand": {
                              "Method": executeShellCommand,
                              "ActionCommand": "pull",
                              "NextAction": "Main Menu"
                         }
                    }
               },
               "Networks": {
                    "Method": promptSelectNetworkAction,
                    "PreviousAction": "Main Menu",
                    "MenuOptions": {
                         "Inspect Network": {
                              "NextAction": "InspectNetworkAction",
                              "PreviousAction": "Networks"
                         },
                         "Prune Networks": {
                              "NextAction": "PruneNetworksAction",
                              "PreviousAction": "Networks"
                         },
                         "Remove Network": {
                              "NextAction": "RemoveNetworkAction",
                              "PreviousAction": "Networks"
                         }
                    },
                    "InspectNetworkAction": {
                         "Method": inspectNetwork,
                         "NextAction": "Select Network",
                         "PreviousAction": "Networks",
                         "ActionCommand": "inspect"
                    },
                    "PruneNetworksAction": {
                         "Method": promptConfirm,
                         "NextAction": "Networks",
                         "PreviousAction": "Networks",
                         "PromptMessage": "Are you sure that you want to prune all networks ?",
                         "PromptOnConfirm": pruneNetworks,
		               "PromptOnDeny": promptSelectNetworkAction,
                    },
                    "RemoveNetworkAction": {
                         "Method": promptConfirm,
                         "NextAction": "Select Network",
                         "PreviousAction": "Networks",
                         "ActionCommand": "rm",
                         "PromptMessage": "Are you sure that you want to remove the network <networkName> ?",
                         "PromptOnConfirm": removeNetwork,
		               "PromptOnDeny": promptSelectNetworkAction,
                    },
                    "Select Network": {
                         "Method": promptSelectNetwork,
                         "NextAction": "Networks",
                         "PreviousAction": "Networks",
                    }
               },
               "Recontain Rules": {
                    "Method": promptRecontainRules,
                    "PreviousAction": "Main Menu",
                    "Run Recontain Rule": {
                         "Method": runRecontainRule,
                         "NextAction": "Main Menu"
                    }                    
               },
               "Remove all unused containers, images unused networks, build cache (system prune -a": {
                    "Method": pruneSystemPrompt,
                    "NextAction": "Main Menu",
                    "PreviousAction": "Main Menu",
                    "PromptMessage": "Are you sure that you want to prune the system ?",
                    "PromptOnConfirm": pruneSystem,
                    "PromptOnDeny": promptMainMenu,
               },
               "Volumes": {
                    "Method": promptSelectVolumeAction,
                    "PreviousAction": "Main Menu",
                    "MenuOptions": {
                         "Create Volume": {
                              "NextAction": "CreateVolumeAction",
                              "PreviousAction": "Volumes"
                         },
                         "Inspect Volume": {
                              "NextAction": "InspectVolumeAction",
                              "PreviousAction": "Volumes"
                         },
                         "Prune Volumes": {
                              "NextAction": "PruneVolumesAction",
                              "PreviousAction": "Volumes"
                         },
                         "Remove Volume": {
                              "NextAction": "RemoveVolumeAction",
                              "PreviousAction": "Volumes"
                         }
                    },
                    "CreateVolumeAction": {
                         "Method": createVolume,
                         "NextAction": "Volumes",
                         "PreviousAction": "Volumes"
                    },
                    "InspectVolumeAction": {
                         "Method": inspectVolume,
                         "NextAction": "Select Volume",
                         "PreviousAction": "Volumes",
                         "ActionCommand": "inspect"
                    },
                    "PruneVolumesAction": {
                         "Method": promptConfirm,
                         "NextAction": "Volumes",
                         "PreviousAction": "Volumes",
                         "PromptMessage": "Are you sure that you want to prune all volumes ?",
                         "PromptOnConfirm": pruneVolumes,
		               "PromptOnDeny": promptSelectVolumeAction,
                    },
                    "RemoveVolumeAction": {
                         "Method": promptConfirm,
                         "NextAction": "Select Volume",
                         "PreviousAction": "Volumes",
                         "ActionCommand": "rm",
                         "PromptMessage": "Are you sure that you want to remove the volume <volumeName> ?",
                         "PromptOnConfirm": removeVolume,
		               "PromptOnDeny": promptSelectVolumeAction,
                    },
                    "Select Volume": {
                         "Method": promptSelectVolume,
                         "NextAction": "Volumes",
                         "PreviousAction": "Volumes",
                    }
               },
               "Exit": {
                    "Method": exit
               }
          }
     }
}

const ruleActionBehaviorState = {
     none: "none",
     stop: "stop",
     stopDelete: "stop-delete"
}

// I use process.cwd() because this is what works when Recontain is packaged using pkg. pkg uses virtual /snapshot directories
const scriptPath = process.cwd() + delimiter;

let recontainRulesValidated = false;

// Validate that the executable exists
commandExists(executable, function(err, commandExists) {
     if (!commandExists) {
          console.log(`WARNING! Unable to locate the command ${executable}!`);
     } 
});

// Validate that the executable for compose exists
commandExists(executable + "-compose", function(err, commandExists) {
     if (!commandExists) {
          console.log(`WARNING! Unable to locate the command ${executable}-compose!`);
     }
});

// Check to see if we can run the executable (docker/podman)
const result = spawnSync(executable,["system","info"], {
     stdio: 'ignore',
});

if (result.status === 1) {
     console.log(`ERROR! Running the command ${executable} system info returns an error. You may not have permission to run ${executable}`);
     process.exit(0);
}

function buildComposeFile(composeFile) {
     const key = "BuildAction";

     if (!isValidKey(key)) {
          console.log(`ERROR! The key ${key} passed to changeFilePermission() for ${composeFile} is not valid`);
          runPreviousAction(key);
          return;
     }

     const buildResult = executeShellCommand(`${executable}-compose`,[ "-f", composeFile,"up","-d"]);

     if (buildResult[0] === "ERROR") {
          runPreviousAction(key);
          return; 
     }

     runNextAction(key);
}

async function changeFilePermission(composeFile) {     
     const key = "ChangePermissionsAction";
     
     if (!isValidKey(key)) {
          console.log(`ERROR! The key ${key} passed to changeFilePermission() for ${composeFile} is not valid`);
          runPreviousAction(key);
          return;
     }

     let permNumberStr = "0";

     while (true) {
          permNumberStr = readline.question("Enter a permision number between 1 and 777 or 0 to exit (Linux only): ");

          if (permNumberStr === "0") {
               runPreviousAction(key);
               return;
          } else if (isNaN(permNumberStr)) {
               permNumberStr = "0";
               continue;
          } else {
               const permNumber = parseInt(permNumberStr);

               if (permNumber < 1 || permNumber > 777) {
                    console.log("Please enter a number between 1 and 777");
                    permNumberStr = "0";
               } else {
                    break;
               }
          }
     }

     fs.chmod(composeFile, permNumberStr.toString(8), (error) => {
          // in-case of any errors
          if (error) {
               console.log(error);
               runPreviousAction(key);
               return;
          }
        
          // do other stuff
          console.log("Permissions have been changed for the file!");
     });

     runNextAction(key);
}

function createVolume() {
     const key = "CreateVolumeAction";

     if (!isValidKey(key)) {
          console.log(`ERROR! The key ${key} passed to changeFilePermission() for ${composeFile} is not valid`);
          runPreviousAction(key);
          return;
     }

     let volumeName = "";

     while (true) {
          volumeName = readline.question("Enter the volume name or press enter to exit: ");

          if (volumeName === "") {
               runPreviousAction(key);
               return;
          }

          if (volumeName.length < 2) {
               console.log(`ERROR! Volume names must be at least 2 characters long`);               
          } else {
               break;
          }
     }

     const createVolumeResult = executeShellCommand(`${executable}`,[ "volume", "create", volumeName]);

     if (createVolumeResult[0] === "ERROR") {
          runPreviousAction(key);
          return; 
     }

     runNextAction(key);
}

async function deleteContainer(containerName, onErrorMethod) {
     const key = "ConfirmDeleteAction";
      
     if (!isValidKey(key)) {
          console.log(`ERROR! The key ${key} passed to deleteContainer() for ${containerName} is not valid`);
          runPreviousAction(key);
          return;
     }

     const stopResult = executeShellCommand(executable,[ "stop", containerName]);

     if (stopResult[0] === "ERROR") {
          console.log(stopResult[1]);
          runPreviousAction(key);
          return; 
     }
	 
     const rmResult = executeShellCommand(executable,[ "rm", containerName]);
	 
     if (rmResult[0] === "ERROR") {
          console.log(rmResult[1]);
          runPreviousAction(key);
          return; 
     }
	 
     runNextAction(key);
}

function editFile(composeFile) {     
     const key = "EditFileAction";

     if (!isValidKey(key)) {
          console.log(`ERROR! The key ${key} in editFile() for ${composeFile} is not valid`);
          promptMainMenu();
          return;
     }

     const defaultEditor = config.has("DefaultEditor") ? config.get("DefaultEditor") : "vi";

     const viProcess = spawnSync(defaultEditor, [composeFile], {
          stdio: 'inherit', // Use the same stdio as the current process
     });

     runNextAction(key);
}

function executeShellCommand(executable,cmd) {
     const result = cp.spawnSync(executable,cmd);
 
     if (result.stderr === null) {
          return ["ERROR",`ERROR! An error occurred running the command ${executable} ${cmd.join(' ')}. Run this command to see if it runs successfully`];
     } else if (result.stderr.length > 0 && result.stderr.indexOf('msg="Found orphan containers') === -1 && result.stderr.indexOf("Error") !== -1) {
          return ["ERROR","ERROR! " + result.stderr.toString()];
     } else {
          return ["OK",result.output.toString()];
     } 
}

function exit(returnCode) {
     process.exit(returnCode);
}

function findByExt(base,ext,files,result) {
    files = files || fs.readdirSync(base) 
    result = result || [] 

    files.forEach( 
        function (file) {
            var newbase = path.join(base,file)
            if ( fs.statSync(newbase).isDirectory() )
            {
                result = findByExt(newbase,ext,fs.readdirSync(newbase),result)
            }
            else
            {
                if ( file.substr(-1*(ext.length+1)) == '.' + ext )
                {
                    result.push(newbase)
                } 
            }
        }
    )

    return result
}

function getContainers() {
     const containerResult = executeShellCommand(executable,[ "ps", "-a", "--format", "{{.Names}} ({{.Status}})"]);

     if (containerResult[0] === "ERROR") {
          console.log(containerResult[1]);
          return null;
     }

     if (typeof containerResult[1] !== "string") {
          console.log(`ERROR! An error occurred getting the containers in getContainers(). The type is ${typeof containerResult[1]}`);
          return null;
     }
 
     const containerNames = containerResult[1];

     let spl=containerNames.split(String.fromCharCode(10));

     // When splitting container names, first & last container names may have a comma in it so remove it if it does
     spl[0]=spl[0].toString().replace(",","");
     spl[spl.length-1]=spl[spl.length-1].toString().replace(",","");

     // Remove any blank container names that may exist at the end of the array
     while (spl[spl.length-1].toString() === "") {
          spl = spl.slice(0,-1);
     }

     spl.sort(sortMethod);
     
     return spl;
}

function getContainerStatus(containerName) {
     const containerStatus = {
          running: "running",
          stopped: "exited"
     }

     const containerInspectResult = executeShellCommand(executable,[ "inspect", containerName]);
     
     if (containerInspectResult[0] === "ERROR") {
          console.log(containerInspectResult[1]);
          return null;
     }
 
     const inspectResult = containerInspectResult[1];

     // If container is not running we can skip trying to parse the status
     for (let j=0;j<inspectResult.length;j++) {
          if (inspectResult[j] !== null) {
               if (inspectResult[j].toString().trim().includes("Error: No such object")) {
                    return containerStatus.stopped;
               }
          }
     }

     const regex = /"Status":\s*"([^"]+)"/;
     const match = regex.exec(inspectResult);

     if (!match) {
          console.log(`ERROR! The container ${containerName} ran into an error checking the container status while running the command '${executable} inspect ${containerName}'`);
          return null;
     }

     return match[1];
}

function getImages() {
     const imageResult = executeShellCommand(executable,[ "image", "ls", "--format", "{{.Repository}}"]);

     if (imageResult[0] === "ERROR") {
          console.log(imageResult[1]);
          return null;
     }
 
     if (typeof imageResult[1] !== "string") {
          console.log(`ERROR! An error occurred getting the images in getImages(). The type is ${typeof imageResult[i]}`);
          return null;
     }

     const imageNames = imageResult[1];

     let spl=imageNames.split(String.fromCharCode(10));

     // When splitting image names, first & last image names may have a comma in it so remove it if it does
     spl[0]=spl[0].toString().replace(",","");
     spl[spl.length-1]=spl[spl.length-1].toString().replace(",","");

     // Remove any blank image names that may exist at the end of the array
     while (spl[spl.length-1].toString() === "") {
          spl = spl.slice(0,-1);
     }

     spl.sort(sortMethod);
     
     return spl;
}

// Since getMapPropertyChild calls itself recursively but the first argument is always recontainMenuMap, I use this metohd to call getMapPropertyChild() so I can only need to specify recontainMenuMap once
function getMapProperty(searchKey, searchProperty) {
     return getMapPropertyChild(recontainMenuMap,searchKey, searchProperty)
}

function getMapPropertyChild(obj, searchKey, searchProperty, results = []) {
     const r = results;

     Object.keys(obj).forEach(key => {
          const value = obj[key];

          if (key === searchKey){ // && (searchProperty === null || (searchProperty !== null && typeof recontainMenuMap[searchKey][searchProperty] !== "undefined"))
               if (typeof searchProperty !== "undefined") {
		          r.push(obj[searchKey][searchProperty]);
               } else {
		          r.push(obj[searchKey]);
               }
          } else if(typeof value === 'object'){
               getMapPropertyChild(value, searchKey, searchProperty, r); // searchProperty, 
          }
     });

     return r[0];
};

function getNetworks() {
     const networkResult = executeShellCommand(executable,[ "network", "ls", "--format", "{{.Name}}"]);

     if (networkResult[0] === "ERROR") {
          console.log(networkResult[1]);
          return null;
     }

     if (typeof networkResult[1] !== "string") {
          console.log(`ERROR! An error occurred getting the networks in getContainers(). The type is ${typeof networkResult[1]}`);
          return null;
     }
 
     const networkNames = networkResult[1];

     let spl=networkNames.split(String.fromCharCode(10));

     // When splitting container names, first & last container names may have a comma in it so remove it if it does
     spl[0]=spl[0].toString().replace(",","");
     spl[spl.length-1]=spl[spl.length-1].toString().replace(",","");

     // Remove any blank container names that may exist at the end of the array
     while (spl[spl.length-1].toString() === "") {
          spl = spl.slice(0,-1);
     }

     spl.sort(sortMethod);
     
     return spl;
}

function getVolumes() {
     const volumeResult = executeShellCommand(executable,[ "volume", "ls", "--format", "{{.Name}}"]);

     if (volumeResult[0] === "ERROR") {
          console.log(volumeResult[1]);
          return null;
     }

     if (typeof volumeResult[1] !== "string") {
          console.log(`ERROR! An error occurred getting the volumes in getVolumes(). The type is ${typeof volumeResult[1]}`);
          return null;
     }
 
     const volumeNames = volumeResult[1];

     let spl=volumeNames.split(String.fromCharCode(10));

     // When splitting container names, first & last container names may have a comma in it so remove it if it does
     spl[0]=spl[0].toString().replace(",","");
     spl[spl.length-1]=spl[spl.length-1].toString().replace(",","");

     // Remove any blank container names that may exist at the end of the array
     while (spl[spl.length-1].toString() === "") {
          spl = spl.slice(0,-1);
     }

     spl.sort(sortMethod);
     
     return spl;
}

function inspectNetwork(networkName) {
     const key = "InspectNetworkAction";
     
     if (!isValidKey(key)) {
          console.log(`ERROR! The key ${key} in inspectNetwork() is not valid`);
          promptMainMenu();
          return;
     }

     const actionCommand = getMapProperty(key,"ActionCommand");

     if (typeof actionCommand !== "string") {
          console.log(`ERROR! An error occurred in inspectNetwork(). The ActionCommand property for ${key} is not a function. It is ${typeof actionCommand} when the option ${networkName} was selected`);
          runPreviousAction(key);
          return;
     }

     spawnSync(executable, ["network", actionCommand,networkName], {
          stdio: 'inherit', // Use the same stdio as the current process
     });

     runNextAction("Select Network");
}

function inspectVolume(volumeName) {
     const key = "InspectVolumeAction";
     
     if (!isValidKey(key)) {
          console.log(`ERROR! The key ${key} in inspectVolume() is not valid`);
          promptMainMenu();
          return;
     }

     const actionCommand = getMapProperty(key,"ActionCommand");

     if (typeof actionCommand !== "string") {
          console.log(`ERROR! An error occurred in inspectVolume(). The ActionCommand property for ${key} is not a function. It is ${typeof actionCommand} when the option ${volumeName} was selected`);
          runPreviousAction(key);
          return;
     }

     spawnSync(executable, ["volume", actionCommand,volumeName], {
          stdio: 'inherit', // Use the same stdio as the current process
     });

     runNextAction("Select Volume");
}

function isValidFilename(string) {
     if (!string || string.length > 255 || string === '.' || string === '..') {
       return false
     }
     return (
       !/[<>:"/\\|?*\u0000-\u001F]/g.test(string) &&
       !/^(con|prn|aux|nul|com\d|lpt\d)$/i.test(string)
     )
}

function isValidKey(key) {
     const keyValidationResult = getMapProperty(key);
     return typeof keyValidationResult !== "undefined"; 
}

function promptConfirm(confirmMsg,onConfirm,onConfirmParameter,onDeny,onDenyParameter) {
     inquirer.prompt([
          {
               type: 'confirm',
               name: 'confirm',
               message: confirmMsg,
          },
     ])
     .then((answer) => {
          if (answer.confirm === true) {
              if (typeof onConfirm === "function") {
                   onConfirm(onConfirmParameter, onDeny);
              } else {
                   console.log(`ERROR! onConfirm is not a function in promptConfirm() when the prompt message is ${confirmMsg} and onConfirm = ${typeof onConfirm}`);
                   runPreviousAction(key);
                   return;
              }
          } else {			 
               if (typeof onDeny === "function") {
                    onDeny(onDenyParameter);
               } else {
                    console.log(`ERROR! onDeny is not a function in promptConfirm() when the prompt message is ${confirmMsg} and onDeny = ${typeof onDeny}`);
                    runPreviousAction(key);
                    return;
               }
          }
     });
}

function promptMainMenu() {
     const choicesArray = getMapProperty("Main Menu","MenuOptions");

     if (typeof choicesArray === "undefined") {
          console.log("ERROR! An error occurred getting the menu items in promptMainMenu(). choicesArray is not defined. Exiting...");
          exit(1);
     }

     const choices=Object.keys(choicesArray);
	 
     if (choices.length === 0) {
          console.log("ERROR! An error occurred getting the menu items in promptMainMenu(). Exiting...");
          exit(1);
     }
	 
     inquirer.prompt([
          {
               type: 'list',
               name: 'action',
               message: 'Please select an action',
			   choices: choices
          },
     ])
     .then((answers) => {
          if (typeof choicesArray[answers.action] === "undefined") {
               console.log("ERROR! An error occurred determining the next step in promptMainMenu()");
               promptMainMenu();
               return;
          }

	     const nextMenuOptionMethod=choicesArray[answers.action]["Method"];
 
	     if (typeof nextMenuOptionMethod !== "function") {
               console.log(`ERROR! nextMenuOptionMethod is not a function in promptMainMenu() when the answer is ${answers.action}. It is ${typeof nextMenuOptionMethod}`);
               promptMainMenu();
               return;
          }

          nextMenuOptionMethod();
     });
}

function promptComposeFiles() {
     const demoComposeFiles = ["/root/nextcloud.yml","/root/postgres.yml","/root/redis.yml","/root/wordpress.yml"];
     const key = "Compose Files";

     if (!isValidKey(key)) {
          console.log(`ERROR! The key ${key} in promptRecontainRules() is not valid`);
          runPreviousAction(key);
          return;
     }

     let sortedComposeList = [];

     if (!demoMode) {
          const recontainRulesFile=config.has("RecontainRulesFile") ? config.get("RecontainRulesFile") : scriptPath + defaultRulesFile;
          const rules = require(recontainRulesFile);
	 
          if (typeof rules !== "object") {
               console.log(`ERROR! An error occurred getting the rule names in promptComposeFiles(). Rules is ${typeof rules}`);
               runPreviousAction(key);
               return;
          }

          const defaultComposeFilePath = config.has("DefaultComposeDirectory") ? config.get("DefaultComposeDirectory") : "";
          const ruleNames = Object.keys(rules);
          const ruleComposeList = [];

          for (let i=0;i<ruleNames.length;i++) {
               const ruleObj = rules[ruleNames[i]];

               const fileName = ruleObj.Filename;
          
               if (typeof fileName === "undefined") {
                    continue;
               }

               let fullPath = "";

               if (typeof ruleObj.ComposePath !== "undefined") {
                    fullPath = ruleObj.ComposePath + (!ruleObj.ComposePath.endsWith(delimiter) ? delimiter : "") + fileName;
               } else if (defaultComposeFilePath !== "") { // TODO: This prevents compose files that happen to be in the current directory from geting picked up. Figure out if you want it to stay this way
                    fullPath = defaultComposeFilePath + (!defaultComposeFilePath.endsWith(delimiter) ? delimiter : "") + fileName;
               }

               if (fullPath !== "") {
                    ruleComposeList.push(fullPath);
               }

               if (typeof ruleObj.AdditionalComposeFiles !== "undefined") {
                    for (let i=0;i<ruleObj.AdditionalComposeFiles.length;i++) {
                         ruleComposeList.push(ruleObj.AdditionalComposeFiles[i]);
                    }
               }
          }

          const defaultComposeList = config.has("DefaultComposeDirectory") ? findByExt(config.get("DefaultComposeDirectory"),'yml') : [];
     
          const unfilteredComposeList = ruleComposeList.concat(defaultComposeList);

          if (unfilteredComposeList.length === 0) {
               console.log(`ERROR! No compose files were found!`);
               runPreviousAction(key);
               return;
          }
     
          const filteredComposeList = unfilteredComposeList.filter((value,index) => unfilteredComposeList.indexOf(value) === index);

          sortedComposeList = filteredComposeList.sort(sortMethod);
     } else {
          sortedComposeList = demoComposeFiles;
     }

     inquirer.prompt([
          {
               type: 'list',
               name: 'compose',
               message: 'Please select the compose file',
               choices: [goBack, ...sortedComposeList]
          },
     ])
     .then((answers) => {
          if (answers.compose === goBack) {
	          runPreviousAction(key);
          } else {
               runNextAction(key,[answers.compose]);
          }
     });
}

function pruneNetworks() {
     const key = "PruneNetworksAction";

     if (!isValidKey(key)) {
          console.log(`ERROR! The key ${key} in pruneNetworks() is not valid`);
          promptMainMenu();
          return;
     }

     const pruneNetworksResult = executeShellCommand(executable,[ "network", "prune", "-f"]);

     if (pruneNetworksResult[0] === "ERROR") {
          console.log(pruneNetworksResult[1]);
          runPreviousAction(key);
          return;
     }

     runNextAction(key);
}

function promptRecontainRules() {
     const demoRecontainRules = ["Adminer", "MySQL", "Nextcloud", "PostGres", "Redis", "WordPress"];
     const runRulesKey = "Recontain Rules";
     const runKey = "Run Recontain Rule";
	  
     if (!isValidKey(runRulesKey)) {
          console.log(`ERROR! The key ${runRulesKey} in promptRecontainRules() is not valid`);
          promptMainMenu();
          return;
     }

     if (!isValidKey(runKey)) {
          console.log(`ERROR! The key ${runKey} in promptRecontainRules() is not valid`);
          runPreviousAction(runRulesKey);
          return;
     }

     const validationResult = validateRecontainRules();

     if (!validationResult) {
          runPreviousAction(runRulesKey);
	     return;
     }
     
     const recontainRulesFile=config.has("RecontainRulesFile") ? config.get("RecontainRulesFile") : scriptPath + defaultRulesFile;

     let ruleNames = [];

     if (!demoMode) {
          const rules = require(recontainRulesFile);
	 
          if (typeof rules !== "object") {
               console.log(`ERROR! An error occurred getting the rule names in promptRecontainRules(). Rules is ${typeof rules}`);
               runPreviousAction(runRulesKey);
               return;
          }

          ruleNames = Object.keys(rules);
 
          if (ruleNames.length === 0) {
               console.log("ERROR! An error occurred getting the rule names in promptRecontainRules(). The ruleNames array is empty");
	       runPreviousAction(runRulesKey);
	       return;
          }
     } else {
          ruleNames = demoRecontainRules;
     }

     inquirer.prompt([
          {
               type: 'list',
               name: 'rule',
               message: 'Please select',
               choices: [goBack, ...ruleNames]
          },
     ])
     .then((answers) => {
          if (answers.rule === goBack) {
               runPreviousAction(runRulesKey);
          } else {
               if (!recontainRulesValidated) {
                    const recontainRulesValid = validateRecontainRules();
					
                    if (!recontainRulesValid) {
		               console.log("ERROR! An error occurred validating the Recontain rules");
			          runPreviousAction(key);
		          }
               }

               const nextMethod = getMapProperty(runKey, "Method");
	       
               if (typeof nextMethod === "function") {
                    const rules = require(recontainRulesFile);

                    const ruleObj=rules[answers.rule];

                    if (typeof ruleObj.Prompt !== "undefined" && ruleObj.Prompt === true) {
                         promptConfirm("Are you sure that you want to run this rule ?", runRecontainRule, answers.rule, promptRecontainRules);
                         //runNextAction(runKey);
                    } else {
                         nextMethod(answers.rule);
                    }
                    //nextMethod(answers.rule);
	       } else {
		          console.log(`ERROR! An error occurred in promptRecontainRules(). The Method property for ${runKey} is not a function. It is ${typeof nextMethod}`);
		          runPreviousAction(runRulesKey);
		          return;
               }
          }
     });
}

function promptSelectComposeFileAction(composeFile) {
     if (typeof composeFile === "undefined") {
          return;
     }

     const key = "SelectComposeFileAction";

     if (!isValidKey(key)) {
          console.log(`ERROR! The key ${key} in promptRecontainRules() is not valid`);
          promptMainMenu();
          return;
     }

     if (composeFile.length === 0) {
          console.log("ERROR! composeFile is an empty string in promptSelectComposeFileAction()!");
          runPreviousAction(key);
          return;		  
     }

     const composeFileActionsArray = getMapProperty(key ,"MenuOptions");
     
     if (typeof composeFileActionsArray === "undefined") {
          console.log("ERROR! composeFileActionsArray is not defined in promptSelectComposeFileAction()"); 
          runPreviousAction(key);
          return;
     }

     const composeFileActions = Object.keys(composeFileActionsArray);

     if (composeFileActions.length === 0) {
          console.log("ERROR! composeFileActions is an empty array in promptSelectComposeFileAction()!");
          runPreviousAction(key);
          return;		  
	}

     inquirer.prompt([
          {
               type: 'list',
               name: 'composeAction',
               message: 'Please select the compose file action',
               choices: [goBack, ...composeFileActions],
          },
     ])
     .then((answers) => {
          if (answers.composeAction === goBack) {
	          runPreviousAction(key);
               return;
          } else {
               const nextActionProperty = getMapProperty(answers.composeAction, "NextAction");

               if (typeof nextActionProperty === "undefined") {
                    console.log(`ERROR! nextActionProperty is not defined in promptSelectComposeAction() when the key is ${key}`);
                    runPreviousAction(key);
                    return;
               }

               const nextActionMethod=getMapProperty(nextActionProperty, "Method");

               if (typeof nextActionMethod !== "function") {
                    console.log(`ERROR! An error occurred in promptSelectComposeFileAction(). The Method property for ${nextActionProperty} is not a function. It is ${typeof nextMethod} when the option ${answers.composeAction} was selected`);
                    runPreviousAction(key);
                    return;
               }

               nextActionMethod(composeFile);
          }
     });
}

async function promptSelectContainer() {
     const demoModeContainers = ["Nextcloud (running)","PostGres (running)","Redis (running)","WordPress (running)"];
     const containers = !demoMode ? await getContainers() : demoModeContainers;
     const key = "Containers";

     if (containers === null) {
          console.log("No containers found!");
          runPreviousAction(key);
	     return;
     }
	 
     if (!isValidKey(key)) {
          console.log(`ERROR! The key ${key} in promptSelectContainer() is not valid`);
          promptMainMenu();
          return;
     }

     inquirer.prompt([
          {
               type: 'list',
               name: 'container',
               message: 'Please select the container',
               choices: [goBack, ...containers]
          },
     ])
     .then((answers) => {
          if (answers.container === goBack) {
	          runPreviousAction(key);
          } else {
	          // Since the status is shown with the container name, separate the status string from the container name
               const containerSplit = answers.container.split(" ");
			   
	          if (containerSplit.length === 0) {
                    console.log(`ERROR! An error occurred in promptSelectContainer() getting the container name.`);
                    runPreviousAction(key);
                    return;
               }

               const containerName = containerSplit[0];
               const containerStatus = containerSplit[1].replace("(","").replace(")","");
			   
               if (containerName === null || containerName === "" || containerStatus === null || containerStatus === "") {
                    console.log("ERROR! An error occurred in promptSelectContainer() splitting the container name and status");
                    runPreviousAction(key);
                    return;
               }

               runNextAction(key, [containerName, containerStatus]);			   
          }
     });
}

function promptSelectContainerAction(containerName, containerStatus) {
     const key = "SelectContainerAction";
     const deleteContainerKey = "Delete Container";

     if (!isValidKey(key)) {
          console.log(`ERROR! The key ${key} in promptRecontainRules() is not valid`);
          promptMainMenu();
          return;
     }

     if (!isValidKey(deleteContainerKey)) {
          console.log(`ERROR! The key ${deleteContainerKey} in promptRecontainRules() is not valid`);
          runPreviousAction(key);
          return;
     }

     if (containerName.length === 0) {
          console.log("ERROR! containerName is an empty string in promptSelectContainerAction()!");
          runPreviousAction(key);
          return;		  
     }
	 
     if (containerStatus.length === 0) {
          console.log("ERROR! containerStatus is an empty string in promptSelectContainerAction()!");
          runPreviousAction(key);
          return;		  
     }

     if (containerStatus !== "Up" && containerStatus !== "Exited") {
          console.log("ERROR! containerStatus is not valid in promptSelectContainerAction()!");
          runPreviousAction(key);
          return;		  
     }

     const containerActionsArray = getMapProperty(key ,"MenuOptions");
     
     if (typeof containerActionsArray === "undefined") {
          console.log("ERROR! containerActionsArray is not defined in promptSelectContainerAction()"); 
          runPreviousAction(key);
          return;
     }

     const containerActions = Object.keys(containerActionsArray);

     if (containerActions.length === 0) {
          console.log("ERROR! containerActions is an empty array in promptSelectContainerAction()!");
          runPreviousAction(key);
          return;		  
	}
	 
     inquirer.prompt([
          {
               type: 'list',
               name: 'containerAction',
               message: 'Please select the container action',
               choices: [goBack, ...containerActions],
          },
     ])
     .then((answers) => {
          if (answers.containerAction === goBack) {
	          runPreviousAction(key);
               return;
          } else {
               const nextAction = containerActionsArray[answers.containerAction]["NextAction"];

               if (typeof nextAction !== "string") {
                    console.log(`ERROR! nextAction is not valid in promptSelectContainerAction() when the option ${answers.containerAction} was selected. It is ${typeof nextAction}`);
                    runPreviousAction(answers.containerAction);
                    return;
               }

               const nextMethod = getMapProperty(nextAction, "Method");

               const actionCommand =  containerActionsArray[answers.containerAction]["ActionCommand"];
               const actionCommandPastTense =  containerActionsArray[answers.containerAction]["ActionCommandPastTense"];
			   
               if (typeof nextMethod !== "function") {
                    console.log(`ERROR! An error occurred in promptSelectContainerAction(). The Method property for ${nextAction} is not a function. It is ${typeof nextMethod} when the option ${answers.containerAction} was selected`);
                    runPreviousAction(key);
                    return;
               }

               if (typeof actionCommand !== "string") {
                    console.log(`ERROR! An error occurred in promptSelectContainerAction(). The ActionCommand property for ${nextAction} is not a function. It is ${typeof actionCommand} when the option ${answers.containerAction} was selected`);
                    runPreviousAction(key);
                    return;
               }

               if (typeof actionCommandPastTense !== "string") {
                    console.log(`ERROR! An error occurred in promptSelectContainerAction(). The ActionCommandPastTense property for ${nextAction} is not a function. It is ${typeof actionCommandPastTense} when the option ${answers.containerAction} was selected`);
                    runPreviousAction(key);
                    return;
               }
			   
               if (answers.containerAction !== deleteContainerKey) {
                    if (actionCommand === "start" && containerStatus === "Up") {
                         console.log(`ERROR! The container ${containerName} is already running!`);
                         runPreviousAction(answers.containerAction);
                         return;                     
                    } else if (actionCommand === "stop" && containerStatus === "Exited") {
                         console.log(`ERROR! The container ${containerName} is already stopped!`);
                         runPreviousAction(answers.containerAction);
                         return;                     
                    } 

                    nextMethod(containerName, actionCommand, actionCommandPastTense);
               } else {
                    let promptMessage =  getMapProperty(nextAction,"PromptMessage");
                    promptMessage = promptMessage.replace("<containerName>",containerName);
				   
                    const promptOnConfirm = getMapProperty(nextAction,"PromptOnConfirm");
                    const promptOnDeny = getMapProperty(nextAction,"PromptOnDeny");
				   
                    if (promptMessage.length === 0) {
                         console.log(`ERROR! An error occurred in promptSelectContainerAction(). The promptMessage property for ${nextAction} is blank`);
                         runPreviousAction(key);
                         return;
                    }

                    if (typeof promptOnConfirm !== "function") {
                         console.log(`ERROR! An error occurred in promptSelectContainerAction(). The PromptOnConfirm property for ${nextAction} is not a function. It is ${typeof promptOnConfirm}`);
                         runPreviousAction(key);
                         return;
                    }

                    if (typeof promptOnDeny !== "function") {
                         console.log(`ERROR! An error occurred in promptSelectContainerAction(). The PromptOnDeny property for ${nextAction} is not a function. It is ${typeof promptOnDeny}`);
                         runPreviousAction(key);
	                    return;
                    }

                    nextMethod(promptMessage, promptOnConfirm, containerName,  promptOnDeny);
               }
          }
     });
}

async function promptSelectImage(imageAction) {
     const demoModeImages = ["mariadb", "nginx", "wordpress"];
     const key = "Images";
     
     if (!isValidKey(key)) {
          console.log(`ERROR! The key ${key} in promptSelectImage() is not valid`);
          promptMainMenu();
          return;
     }

     const images = !demoMode ? await getImages() : demoModeImages;

     if (images === null) {
          console.log("ERROR! images is null in promptSelectImage()");
          runPreviousAction(key);
          return;
     }
	 
     inquirer.prompt([
          {
               type: 'list',
               name: 'image',
               message: 'Please select the image',
               choices: [goBack, ...images]
          },
     ])
     .then((answers) => {
          if (answers.image === goBack) {
               runPreviousAction(imageAction);
               return;
          } else {
               const nextAction = getMapProperty(imageAction,"NextAction");
               const nextImageAction = getMapProperty(nextAction, "NextAction");
               const nextMethod = getMapProperty(nextImageAction, "Method");
               const nextActionCommand = getMapProperty(nextImageAction, "ActionCommand");

               if (typeof nextAction !== "string") {
                    console.log(`ERROR! An error occurred in promptSelectImage(). The NextAction property for ${imageAction} is not a string. It is ${typeof nextAction}`);
                    runPreviousAction(key);
                    return;
               }

               if (typeof nextImageAction !== "string") {
                    console.log(`ERROR! An error occurred in promptSelectImage(). The NextAction property for ${nextAction} is not a string. It is ${typeof nextImageAction}`);
                    runPreviousAction(key);
                    return;
               }

               if (typeof nextMethod !== "function") {
                    console.log(`ERROR! An error occurred in promptSelectImage(). The Method property for ${nextImageAction} is not a function. It is ${typeof nextMethod}`);
                    runPreviousAction(key);
                    return;
               }
			   
               if (typeof nextActionCommand !== "string") {
                    console.log(`ERROR! An error occurred in promptSelectImage(). The ActionCommand property for ${nextImageAction} is not a string. It is ${typeof nextActionCommand}`);
                    runPreviousAction(key);
                    return;
               }
			   
               const shellCommandResult = nextMethod(executable, [nextActionCommand, answers.image]);

               if (shellCommandResult[0] === "ERROR") {
                    console.log(shellCommandResult[1]);
                    runPreviousAction(key);
               }

               runNextAction(nextImageAction);
          }
     });
}

function promptSelectImageAction() {
     const key = "Images";

     if (!isValidKey(key)) {
          console.log(`ERROR! The key ${key} in promptSelectImageAction() is not valid`);
          promptMainMenu();
          return;
     }

     const pruneKey = "Prune unused images";

     if (!isValidKey(pruneKey)) {
          console.log(`ERROR! The key ${pruneKey} in promptSelectImageAction() is not valid`);
          runPreviousAction(key);
          return;
     }

     const selectImageActionsArray = getMapProperty(key,"MenuOptions");
	 
     if (typeof selectImageActionsArray !== "object") {
          console.log("ERROR! selectImageActionsArray is not valid in promptSelectImageAction()");
          runPreviousAction(key);
          return;
     }

     const selectImageActions = Object.keys(selectImageActionsArray);
 
     if (selectImageActions.length === 0) {
          console.log("ERROR! selectImageActions array is empty in promptSelectImageAction()");
          runPreviousAction(key);
          return;
     }

     inquirer.prompt([
          {
               type: 'list',
               name: 'imageAction',
               message: 'Please select the image action',
               choices: ['Go Back',  ...selectImageActions],
          },
     ])
     .then((answers) => {
          if (answers.imageAction === goBack) {
               runPreviousAction(key);
               return;
          }

          if (answers.imageAction !== pruneKey) {
               const nextAction = selectImageActionsArray[answers.imageAction]["NextAction"];

               if (typeof nextAction !== "string") {
                    console.log(`ERROR! An error occurred in promptSelectImageAction(). The NextAction property for ${answers.imageAction} is not a string. It is ${typeof nextAction}`);
                    runPreviousAction(key);
                    return;
               }

               const nextMethod = getMapProperty(nextAction, "Method");

               if (typeof nextMethod !== "function") {
                    console.log(`ERROR! An error occurred in promptSelectImageAction(). The Method property for ${nextAction} is not a function. It is ${typeof nextMethod}`);
                    runPreviousAction(key);
                    return;
               }

               nextMethod(answers.imageAction);
          } else {
               const nextAction = getMapProperty(answers.imageAction ,"NextAction");
               const nextMethod = getMapProperty(nextAction, "Method");

               if (nextAction !== "string") {
	               console.log(`ERROR! An error occurred in promptSelectImageAction(). The NextAction property for ${answers.imageAction} is not a string. It is ${typeof nextAction}`);
                    runPreviousAction(key);
                    return;
               }

               if (typeof nextMethod !== "function") {
                    console.log(`ERROR! An error occurred in promptSelectImageAction(). The Method property for ${nextAction} is not a function. It is ${typeof nextMethod}`);
                    runPreviousAction(key);
                    return;
               }
  
               const result = nextMethod(executable, ["image", "prune", "-a"]);

               if (result[0] === "ERROR") {
                    console.log(result[1]);
               }

               runNextAction(nextAction);			   
          }
     });
}

function promptSelectNetwork(networkAction) {
     const demoNetworks = ["bridge","host","none","MyNetwork"];
     const key = "Select Network";

     if (!isValidKey(key)) {
          console.log(`ERROR! The key ${key} in promptSelectNetwork() is not valid for the network action ${networkAction}`);
          promptMainMenu();
          return;
     }

     const removeNetworkActionKey = "RemoveNetworkAction";
     
     if (!isValidKey(removeNetworkActionKey)) {
          console.log(`ERROR! The key ${removeNetworkActionKey} in promptSelectNetwork() is not valid for the network action ${networkAction}`);
          runPreviousAction(key);
          return;
     }

     const networks = !demoMode ? getNetworks() : demoNetworks;

     if (networks === null) {
          console.log("No networks found!");
          runPreviousAction(key);
	     return;
     }

     inquirer.prompt([
          {
               type: 'list',
               name: 'network',
               message: 'Please select the network',
               choices: [goBack, ...networks]
          },
     ])
     .then((answers) => {
          if (answers.network === goBack) {
	          runPreviousAction(key);
          } else if (networkAction === removeNetworkActionKey) {
               const nextMethod = getMapProperty(networkAction, "Method");

               if (typeof nextMethod !== "function") {
                    console.log(`ERROR! An error occurred in promptSelectNetwork(). The Method property for ${nextContainerAction} is not a function. It is ${typeof nextMethod} when the option ${answers.networkAction} was selected`);
                    runPreviousAction(key);
                    return;
               }

               let promptMessage =  getMapProperty(networkAction,"PromptMessage");
               promptMessage = promptMessage.replace("<networkName>",answers.network);
				   
               const promptOnConfirm = getMapProperty(networkAction,"PromptOnConfirm");
               const promptOnDeny = getMapProperty(networkAction,"PromptOnDeny");
				   
               if (promptMessage.length === 0) {
                    console.log(`ERROR! An error occurred in promptSelectNetwork(). The promptMessage property for ${networkAction} is blank`);
                    runPreviousAction(key);
                    return;
               }

               if (typeof promptOnConfirm !== "function") {
                    console.log(`ERROR! An error occurred in promptSelectNetwork(). The PromptOnConfirm property for ${networkAction} is not a function. It is ${typeof promptOnConfirm}`);
                    runPreviousAction(key);
                    return;
               }

               if (typeof promptOnDeny !== "function") {
                    console.log(`ERROR! An error occurred in promptSelectNetwork(). The PromptOnDeny property for ${networkAction} is not a function. It is ${typeof promptOnDeny}`);
                    runPreviousAction(key);
	               return;
               }

               nextMethod(promptMessage, promptOnConfirm, answers.network,  promptOnDeny);
          } else { 
               if (typeof networkAction === "undefined") {
                    console.log(`ERROR!: Network action is not defined in promptSelectNetwork()`);
                    runPreviousAction(key);
                    return;
               }

               const nextMethod = getMapProperty(networkAction, "Method");

               if (typeof nextMethod !== "function") {
                    console.log(`ERROR! An error occurred in promptSelectNetwork(). The Method property for ${networkAction} is not a function. It is ${typeof nextMethod}`);
                    runPreviousAction(key);
                    return;
               }
               
               nextMethod(answers.network);			   
          }
     });
}

function promptSelectNetworkAction() {
     const key = "Networks";

     if (!isValidKey(key)) {
          console.log(`ERROR! The key ${key} in promptSelectNetworkAction() is not valid`);
          promptMainMenu();
          return;
     }

     const pruneNetworkKey = "Prune Networks";

     if (!isValidKey(pruneNetworkKey)) {
          console.log(`ERROR! The key ${pruneNetworkKey} in promptSelectNetworkAction() is not valid`);
          runPreviousAction(key);
          return;
     }

     const networkActionsArray = getMapProperty(key,"MenuOptions");

     if (typeof networkActionsArray === "undefined") {
          console.log("ERROR! An error occurred getting the menu items in promptSelectNetworkAction(). networkActionsArray is not defined. Exiting...");
          runPreviousAction(key);
     }

     const networkActions=Object.keys(networkActionsArray);

     inquirer.prompt([
          {
               type: 'list',
               name: 'networkAction',
               message: 'Please select the network action',
               choices: [goBack, ...networkActions]
          },
     ])
     .then((answers) => {
          if (answers.networkAction === goBack) {
	          runPreviousAction(key);
          }  else {
               const nextAction = getMapProperty(answers.networkAction,"NextAction");
               
               if (typeof nextAction !== "string") {
                    console.log(`ERROR! An error occurred in promptSelectNetworkAction(). The NextAction property for ${answers.networkAction} is not a string. It is ${typeof nextAction}`);
                    runPreviousAction(key);
                    return;
               }

               // All other options require you to select the network next
               if (answers.networkAction === pruneNetworkKey) {
                    const promptMessage =  getMapProperty(nextAction,"PromptMessage");
				   
                    const promptOnConfirm = getMapProperty(nextAction,"PromptOnConfirm");
                    const promptOnDeny = getMapProperty(nextAction,"PromptOnDeny");
				   
                    if (promptMessage.length === 0) {
                         console.log(`ERROR! An error occurred in promptSelectNetworkAction(). The promptMessage property for ${nextAction} is blank`);
                         runPreviousAction(key);
                         return;
                    }

                    if (typeof promptOnConfirm !== "function") {
                         console.log(`ERROR! An error occurred in promptSelectNetworkAction(). The PromptOnConfirm property for ${nextAction} is not a function. It is ${typeof promptOnConfirm}`);
                         runPreviousAction(key);
                         return;
                    }

                    if (typeof promptOnDeny !== "function") {
                         console.log(`ERROR! An error occurred in promptSelectNetworkAction(). The PromptOnDeny property for ${nextAction} is not a function. It is ${typeof promptOnDeny}`);
                         runPreviousAction(key);
	                    return;
                    }

                    const nextMethod = getMapProperty(nextAction, "Method");

                    if (typeof nextMethod !== "function") {
                         console.log(`ERROR! An error occurred in promptSelectNetworkAction(). The Method property for ${nextAction} is not a function. It is ${typeof nextMethod} when the option ${answers.networkAction} was selected`);
                         runPreviousAction(key);
                         return;
                    }

                    nextMethod(promptMessage, promptOnConfirm, null,  promptOnDeny);
               } else {
                    runNextAction(nextAction, [nextAction])
               }		   
          }
     });
}

function promptSelectVolume(volumeAction) {
     const demoVolumes = ["a2f4b1e983c0d7a8b4901c2f3d5e6f7210c3b4a5f6e7d8c9a0b1c2d3e4f5a6","9d8e7f6a5b4c3d2e1f0a2b3c4d5e6f79876543210abcdef0123456789abcdef","c9a8b7d6e5f4a3b2c1d0e7f8c2a1b3d4e5f6a7b8c9d0e1f2a3456789abcdef","1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1","f0e1d2c3b4a5f6e7d8c9a0b1c2d3e4f5a6789abcdef0123456789abcdef0"];

     const key = "Select Volume";

     if (!isValidKey(key)) {
          console.log(`ERROR! The key ${key} in promptSelectVolume() is not valid for the volume action ${volumeAction}`);
          promptMainMenu();
          return;
     }

     const removeVolumeActionKey = "RemoveVolumeAction";
     
     if (!isValidKey(removeVolumeActionKey)) {
          console.log(`ERROR! The key ${removeVolumeActionKey} in promptSelectVolume() is not valid for the volume action ${volumeAction}`);
          runPreviousAction(key);
          return;
     }

     const volumes = !demoMode ? getVolumes() : demoVolumes;

     if (volumes === null) {
          console.log("No volumes found!");
          runPreviousAction(key);
	     return;
     }

     inquirer.prompt([
          {
               type: 'list',
               name: 'volume',
               message: 'Please select the volume',
               choices: [goBack, ...volumes]
          },
     ])
     .then((answers) => {
          if (answers.volume === goBack) {
	          runPreviousAction(key);
          } else if (volumeAction === removeVolumeActionKey) {
               const nextMethod = getMapProperty(volumeAction, "Method");

               if (typeof nextMethod !== "function") {
                    console.log(`ERROR! An error occurred in promptSelectVolume(). The Method property for ${nextContainerAction} is not a function. It is ${typeof nextMethod} when the option ${answers.volumeAction} was selected`);
                    runPreviousAction(key);
                    return;
               }

               let promptMessage =  getMapProperty(volumeAction,"PromptMessage");
               promptMessage = promptMessage.replace("<volumeName>",answers.volume);
				   
               const promptOnConfirm = getMapProperty(volumeAction,"PromptOnConfirm");
               const promptOnDeny = getMapProperty(volumeAction,"PromptOnDeny");
				   
               if (promptMessage.length === 0) {
                    console.log(`ERROR! An error occurred in promptSelectVolume(). The promptMessage property for ${volumeAction} is blank`);
                    runPreviousAction(key);
                    return;
               }

               if (typeof promptOnConfirm !== "function") {
                    console.log(`ERROR! An error occurred in promptSelectVolume(). The PromptOnConfirm property for ${volumeAction} is not a function. It is ${typeof promptOnConfirm}`);
                    runPreviousAction(key);
                    return;
               }

               if (typeof promptOnDeny !== "function") {
                    console.log(`ERROR! An error occurred in promptSelectVolume(). The PromptOnDeny property for ${volumeAction} is not a function. It is ${typeof promptOnDeny}`);
                    runPreviousAction(key);
	               return;
               }

               nextMethod(promptMessage, promptOnConfirm, answers.volume,  promptOnDeny);
          } else { 
               if (typeof volumeAction === "undefined") {
                    console.log(`ERROR!: Volume action is not defined in promptSelectVolume()`);
                    runPreviousAction(key);
                    return;
               }

               const nextMethod = getMapProperty(volumeAction, "Method");

               if (typeof nextMethod !== "function") {
                    console.log(`ERROR! An error occurred in promptSelectVolume(). The Method property for ${volumeAction} is not a function. It is ${typeof nextMethod}`);
                    runPreviousAction(key);
                    return;
               }
               
               nextMethod(answers.volume);			   
          }
     });
}

function promptSelectVolumeAction() {
     const key = "Volumes";

     if (!isValidKey(key)) {
          console.log(`ERROR! The key ${key} in promptSelectVolumeAction() is not valid`);
          promptMainMenu();
          return;
     }

     const pruneVolumesKey = "Prune Volumes";

     if (!isValidKey(pruneVolumesKey)) {
          console.log(`ERROR! The key ${pruneVolumesKey} in promptSelectVolumeAction() is not valid`);
          runPreviousAction(key);
          return;
     }

     const volumeActionsArray = getMapProperty(key,"MenuOptions");

     if (typeof volumeActionsArray === "undefined") {
          console.log(`ERROR! The key ${volumeActionsArray} in promptSelectVolumeAction() is not valid`);
          runPreviousAction(key);
     }

     const createVolumeKey = "Create Volume";

     if (typeof createVolumeKey  === "undefined") {
          console.log(`ERROR! The key ${createVolumeKey} in promptSelectVolumeAction() is not valid`);
          runPreviousAction(key);
     }

     const volumeActions=Object.keys(volumeActionsArray);

     inquirer.prompt([
          {
               type: 'list',
               name: 'volumeAction',
               message: 'Please select the volume action',
               choices: [goBack, ...volumeActions]
          },
     ])
     .then((answers) => {
          if (answers.volumeAction === goBack) {
	          runPreviousAction(key);
          }  else {
               const nextAction = getMapProperty(answers.volumeAction,"NextAction");
               
               if (typeof nextAction !== "string") {
                    console.log(`ERROR! An error occurred in promptSelectVolumeAction(). The NextAction property for ${answers.volumeAction} is not a string. It is ${typeof nextAction}`);
                    runPreviousAction(key);
                    return;
               }

               if (answers.volumeAction === pruneVolumesKey) {
                    const promptMessage =  getMapProperty(nextAction,"PromptMessage");
				   
                    const promptOnConfirm = getMapProperty(nextAction,"PromptOnConfirm");
                    const promptOnDeny = getMapProperty(nextAction,"PromptOnDeny");
				   
                    if (promptMessage.length === 0) {
                         console.log(`ERROR! An error occurred in promptSelectVolumeAction(). The promptMessage property for ${nextAction} is blank`);
                         runPreviousAction(key);
                         return;
                    }

                    if (typeof promptOnConfirm !== "function") {
                         console.log(`ERROR! An error occurred in promptSelectVolumeAction(). The PromptOnConfirm property for ${nextAction} is not a function. It is ${typeof promptOnConfirm}`);
                         runPreviousAction(key);
                         return;
                    }

                    if (typeof promptOnDeny !== "function") {
                         console.log(`ERROR! An error occurred in promptSelectVolumeAction(). The PromptOnDeny property for ${nextAction} is not a function. It is ${typeof promptOnDeny}`);
                         runPreviousAction(key);
	                    return;
                    }

                    const nextMethod = getMapProperty(nextAction, "Method");

                    if (typeof nextMethod !== "function") {
                         console.log(`ERROR! An error occurred in promptSelectVolumeAction(). The Method property for ${nextAction} is not a function. It is ${typeof nextMethod} when the option ${answers.volumeAction} was selected`);
                         runPreviousAction(key);
                         return;
                    }

                    nextMethod(promptMessage, promptOnConfirm, null,  promptOnDeny);
               } else if (answers.volumeAction === createVolumeKey) {
                    runNextAction(answers.volumeAction);
               } else {
                    runNextAction(nextAction, [nextAction])
               }		   
          }
     });
}

function pruneSystem(key) {
     if (!isValidKey(key)) {
          console.log(`ERROR! The key ${key} passed to pruneSystem() is not valid`);
          promptMainMenu();
          return;
     }

     const pruneSystemResult = executeShellCommand(executable,[ "system", "prune", "-a"]);

     if (pruneSystemResult[0] === "ERROR") {
          console.log(pruneSystemResult[1]);
          runPreviousAction(key);
          return;
     }

     runNextAction(key);
}

function pruneSystemPrompt() {
     const key = "Remove all unused containers, images unused networks, build cache (system prune -a";
     
     if (!isValidKey(key)) {
          console.log(`ERROR! The key ${key} in pruneSystemPrompt() is not valid`);
          promptMainMenu();
          return;
     }

     const promptMessage =  getMapProperty(key,"PromptMessage");
     const promptOnConfirm = getMapProperty(key,"PromptOnConfirm");
     const promptOnDeny = getMapProperty(key,"PromptOnDeny");
	 
     if (promptMessage.length === 0) {
          console.log(`ERROR! An error occurred in pruneSystemPrompt(). The promptMessage property for ${key} is blank`);
          runPreviousAction(key);
          return;
     }
	 
     if (typeof promptOnConfirm !== "function") {
          console.log(`ERROR! An error occurred in pruneSystemPrompt(). The PromptOnConfirm property for ${key} is not a function. It is ${typeof promptOnConfirm}`);
          runPreviousAction(key);
          return;
     }

     if (typeof promptOnDeny !== "function") {
          console.log(`ERROR! An error occurred in pruneSystemPrompt(). The PromptOnDeny property for ${key} is not a function. It is ${typeof promptOnDeny}`);
          runPreviousAction(key);
          return;
     }
   
     promptConfirm(promptMessage, promptOnConfirm, key, promptOnDeny);
}

function pruneVolumes() {
     const key = "PruneVolumesAction";

     if (!isValidKey(key)) {
          console.log(`ERROR! The key ${key} in pruneVolumes() is not valid`);
          promptMainMenu();
          return;
     }

     const pruneVolumesResult = executeShellCommand(executable,[ "volume", "prune", "-f"]);

     if (pruneVolumesResult[0] === "ERROR") {
          console.log(pruneVolumesResult[1]);
          runPreviousAction(key);
          return;
     }

     runNextAction(key);
}

function removeNetwork(networkName) {
     const key = "RemoveNetworkAction";

     if (!isValidKey(key)) {
          console.log(`ERROR! The key ${key} in removeNetwork() is not valid`);
          promptMainMenu();
          return;
     }

     const selectNetworkKey = "Select Network";

     if (!isValidKey(selectNetworkKey)) {
          console.log(`ERROR! The key ${key} in removeNetwork() is not valid`);
          promptMainMenu();
          return;
     }

     const pruneNetworksResult = executeShellCommand(executable,[ "network", "rm", networkName , "-f"]);

     if (pruneNetworksResult[0] === "ERROR") {
          console.log(pruneNetworksResult[1]);
          runPreviousAction(key);
          return;
     }

     const nextAction = getMapProperty(selectNetworkKey,"NextAction");

     if (typeof nextAction !== "string") {
          console.log(`ERROR! An error occurred in promptSelectNetworkAction(). The NextAction property for ${key} is not a string. It is ${typeof nextAction}`);
          runPreviousAction(key);
          return;
     }

     const nextMethod = getMapProperty(nextAction, "Method");

     if (typeof nextMethod !== "function") {
          console.log(`ERROR! An error occurred in promptSelectNetworkAction(). The Method property for ${nextAction} is not a function. It is ${typeof nextMethod} when the network ${networkName} was selected`);
          runPreviousAction(key);
          return;
     }

     nextMethod();
}

function removeVolume(volumeName) {
     const key = "RemoveVolumeAction";

     if (!isValidKey(key)) {
          console.log(`ERROR! The key ${key} in removeVolume() is not valid`);
          promptMainMenu();
          return;
     }

     const selectVolumeKey = "Select Volume";

     if (!isValidKey(selectVolumeKey)) {
          console.log(`ERROR! The key ${key} in removeVolume() is not valid`);
          promptMainMenu();
          return;
     }

     const pruneVolumesResult = executeShellCommand(executable,[ "volume", "rm", volumeName , "-f"]);

     if (pruneVolumesResult[0] === "ERROR") {
          console.log(pruneVolumesResult[1]);
          runPreviousAction(key);
          return;
     }

     const nextAction = getMapProperty(selectVolumeKey,"NextAction");

     if (typeof nextAction !== "string") {
          console.log(`ERROR! An error occurred in promptSelectVolumeAction(). The NextAction property for ${key} is not a string. It is ${typeof nextAction}`);
          runPreviousAction(key);
          return;
     }

     const nextMethod = getMapProperty(nextAction, "Method");

     if (typeof nextMethod !== "function") {
          console.log(`ERROR! An error occurred in promptSelectVolumeAction(). The Method property for ${nextAction} is not a function. It is ${typeof nextMethod} when the volume ${volumeName} was selected`);
          runPreviousAction(key);
          return;
     }

     nextMethod();
}

async function renameFile(composeFile) {
     const key = "RenameFileAction";

     if (!isValidKey(key)) {
          console.log(`ERROR! The key ${key} passed to renameFile() for ${composeFile} is not valid`);
          runPreviousAction(key);
          return;
     }

     let fileName = "";

     while (true) {
          fileName = readline.question("Enter the new file name or press enter to exit: ");

          if (fileName === "") {
               break
          } 
          
          if (!isValidFilename(fileName)) {
               console.log(`The file name ${fileName} is not valid`);
               fileName = "";
          } else {
               break;
          }
     }

     if (fileName.indexOf(".") === -1) {
          fileName+=".yml";
     }

     const composeFilePath = composeFile.substring(0,composeFile.lastIndexOf(delimiter));
     
     const currentDirectory = process.cwd();

     try {
          process.chdir(composeFilePath);
     } catch (e) {
          console.log(`ERROR! Unable to change to the directory ${composeFilePath} with the error ${e.message}`);
          return null;
     }

     if (fs.existsSync(composeFile)){
          fs.renameSync(composeFile, fileName);
     }

     process.chdir(composeFilePath);

     runNextAction(key);
}

function runContainerAction(containerName,actionName,actionString) {
     const key = "ContainerAction";

     if (!isValidKey(key)) {
          console.log(`ERROR! The key ${key} passed to runContainerAction() for ${containerName} is not valid`);
          promptMainMenu();
          return;
     }

     const containerActionResult = executeShellCommand(executable,[ actionName, containerName]);

     if (containerActionResult[0] === "ERROR") {
          console.log(containerActionResult[1]);
	     runPreviousAction(key);
	     return;
     } 
     
     console.log(`The container ${containerName} has been ${actionString}`);

     runNextAction(key);
}

function runNextAction(currentKey,args = null) {
     if (!isValidKey(currentKey)) {
          console.log(`ERROR! The key ${currentKey} passed to runNextAction() is not valid`);
          promptMainMenu();
          return;
     }

     const nextActionProperty=getMapProperty(currentKey, "NextAction");

     if (typeof nextActionProperty === "undefined") {
          console.log(`ERROR! nextActionProperty is not defined in runNextAction() when the current key is ${currentKey}`);

          const previousActionProperty=getMapProperty(currentKey, "PreviousAction");

          if (typeof previousActionProperty !== "undefined") {
	          runPreviousAction(currentKey);
          } else {
               runPreviousAction(key);
          }

          return;
     }
 
     const nextActionMethod=getMapProperty(nextActionProperty, "Method");

     if (typeof nextActionMethod !== "function") {
          console.log(`ERROR! The property Method for ${nextActionProperty} in nextActionMethod() is not a function when the current key is ${currentKey}. It is ${typeof nextActionMethod}`);
          runPreviousAction(currentKey);
          return;
     }
 
     if (args !== null) {
          nextActionMethod(args[0],args[1]);
     } else {
          nextActionMethod();
     }
}

function runPreviousAction(currentKey) {
     if (!isValidKey(currentKey)) {
          console.log(`ERROR! The key ${currentKey} passed to runPreviousAction() is not valid`);
          promptMainMenu();
          return;
     }

     const previousActionProperty=getMapProperty(currentKey, "PreviousAction");
     
     if (typeof previousActionProperty === "undefined") {
          console.log(`ERROR! previousActionProperty is not defined in runPreviousAction() when the current key is ${currentKey}`);
          runPreviousAction(key);
          return;
     }
 
     const previousActionMethod=getMapProperty(previousActionProperty, "Method");

	 if (typeof previousActionMethod !== "function") {
            console.log(`ERROR! The property Method for ${previousActionProperty} in previousActionMethod() is not a function when the current key is ${typeof currentKey}. It is ${typeof previousActionMethod}`);
	       runPreviousAction(key);
		  return;
	 }
	 
	 previousActionMethod();
}

// validateRecontainRules has already been called by the time this method is called so no additional validation for the config or rules file properties are needed
function runRecontainRule(ruleName) {
     const recontainRulesFile=config.has("RecontainRulesFile") ? config.get("RecontainRulesFile") : scriptPath + defaultRulesFile;

     const rules = require(recontainRulesFile);

     const ruleActionBehavior = config.has("RuleActionBehavior") ? config.get("RuleActionBehavior") : ruleActionBehaviorState.stopDelete;

     const ruleObj=rules[ruleName];

     const silent = config.get("Silent");

     const defaultComposeDirectory = config.has("DefaultComposeDirectory") ? config.get("DefaultComposeDirectory") : "";

     if (defaultComposeDirectory === "" && typeof ruleObj.ComposePath === "undefined") {
          console.log(`ERROR! Unable to determine the compose file path for ${ruleName}. DefaultComposeDirectory is not set in the config file and the rule does not have the ComposePath property!`)
          return null;
     }

     // Loop through each container defined in the current object
     for (let i=0;i<ruleObj.Containers.length;i++) {
	     const statusValue=getContainerStatus(ruleObj.Containers[i]);
 
	     if (statusValue === "running" && ruleActionBehavior !== ruleActionBehaviorState.none) {
	          if (!silent) {
                    console.log(`Stopping the container ${ruleObj.Containers[i]}`);
               }
			   
	          const stopResult = executeShellCommand(executable,[ "stop", ruleObj.Containers[i]]);

               if (stopResult[0] === "ERROR") {
                    console.log(stopResult[1]);
                    return null;
               }
			   
	          if (ruleActionBehavior === ruleActionBehaviorState.stopDelete) {
                    if (!silent) {
                         console.log(`Removing the container ${ruleObj.Containers[i]}`);
                    }

                    const rmResult = executeShellCommand(executable,[ "rm", ruleObj.Containers[i]]);

                    if (rmResult[0] === "ERROR") {
                         console.log(rmResult[1]);
                         return null;
                    }
	          }
          }
     }     

     let fullComposeFilePath = typeof ruleObj.ComposePath !== "undefined" && ruleObj.ComposePath !== "" ? ruleObj.ComposePath : defaultComposeDirectory;

     if (fullComposeFilePath.slice(-1) !== delimiter) {
          fullComposeFilePath+=delimiter;
     }

     const currentDirectory = process.cwd();
     
     try {
          process.chdir(fullComposeFilePath);
     } catch (e) {
          console.log(`ERROR! Unable to change to the directory ${fullComposeFilePath} with the error ${e.message}`);
          return null;
     }

     if (!silent) {
          console.log(`Running the Recontain rule ${ruleName} based on ${ruleObj.Filename}`);
     }

     const composeResult = executeShellCommand(`${executable}-compose`,[ "-f", ruleObj.Filename,"up","-d"]);

     if (composeResult[0] === "ERROR") {
          console.log(composeResult[1]);
          return null;
     }

     process.chdir(currentDirectory);
     
     if (typeof ruleObj.AdditionalComposeFiles !== "undefined") {
          for (let i=0;i<ruleObj.AdditionalComposeFiles.length;i++) {
               let fullAdditionalComposeFilePath=ruleObj.AdditionalComposeFiles[i].substring(0,ruleObj.AdditionalComposeFiles[i].lastIndexOf(delimiter));
                  
               const currentDirectory = process.cwd();

               try {
                    process.chdir(fullAdditionalComposeFilePath);
               } catch (e) {
                    console.log(`ERROR! Unable to change to the directory ${fullAdditionalComposeFilePath} with the error ${e.message}`);
                    return null;
               }
       
               if (!silent) {
                    console.log(`Executing additional compose file ${ruleObj.AdditionalComposeFiles[i]}`);
               }
     
               const additionalComposeResult = executeShellCommand(`${executable}-compose`,[ "-f", ruleObj.AdditionalComposeFiles[i],"up","-d"]);

               if (additionalComposeResult[0] === "ERROR") {
                    console.log(additionalComposeResult[1]);
                    return null;
               }

               process.chdir(currentDirectory);

               console.log(`The additional compose file ${ruleObj.AdditionalComposeFiles[i]} has been recreated`);
          }
     }
     
     if (typeof ruleObj.AdditionalCommands !== "undefined") {
          for (let i=0;i<ruleObj.AdditionalCommands.length;i++) {
               const cmdSplit = ruleObj.AdditionalCommands[i].split(" ");
               const [cmd,...params] = cmdSplit;

               for (let j=0;j<params.length;j++) {
                    if (params[j].indexOf("<RULENAME>") !== -1) {
                         params[j] = params[j].replace("<RULENAME>", ruleName);
                    }

                    if (params[j].indexOf("<RULENAME_LOWERCASE>") !== -1) {
                         params[j] = params[j].replace("<RULENAME_LOWERCASE>", ruleName.toLowerCase());
                    }

                    if (params[j].indexOf("<PORT>") !== -1) {
                         if (typeof ruleObj.Port === "undefined") {
                              console.log(`The Recontain ${ruleName} has the command ${ruleObj.AdditionalCommands[i]} that references Port but the Port is not defined. Skipping this command`);
                              continue;
                         }

                         params[j] = params[j].replace("<PORT>", ruleObj.Port);
                    }
               }

               const commandResult = executeShellCommand(cmd,params);

               if (commandResult[0] === "ERROR") {
                    console.log(commandResult[1]);
               }
          }
     }

     console.log(`The Recontain ${ruleName} has been recreated based on ${ruleObj.Filename}` + (typeof ruleObj.Port !== "undefined" ? ` and is running on port ${ruleObj.Port}` : ``));
    
     promptRecontainRules(); 
}

function sortMethod(a,b) {
     return a.toLowerCase().localeCompare(b.toLowerCase());
}

function validateRecontainRules(ruleName = "") {
     // All valid attributes in the Recontain rules JSON. All others properties not defined here will be ignored
     const ruleColumns = {
          "Filename": {
               Required: true
          },
          "Port": {
               Required: false
          },
          "Containers": {
               Required: true
          },
          "ComposePath": {
               Required: false
          },
          "AdditionalComposeFiles": {
               Required: false
          },
          "AdditionalCommands": {
               Required: false
          }
     };

     // Validate RecontainRulesFile if set
     if (config.has("RecontainRulesFile")) {
          const recontainRulesFile=config.get("RecontainRulesFile");

          if ((typeof recontainRulesFile === "undefined" || (typeof recontainRulesFile !== "undefined" && recontainRulesFile.length === 0))) {
               console.log("ERROR! An error occurred getting the name of the Recontain rules file in validateRecontainRules() from the config file");
               return false;
          }
     }

     const recontainRulesFile=config.has("RecontainRulesFile") ? config.get("RecontainRulesFile") : scriptPath + defaultRulesFile;
     
     try {
          if (!fs.existsSync(recontainRulesFile)) {
               console.log(`ERROR! An error occurred locating the Recontain rules file in validateRecontainRules() in ${scriptPath + defaultRulesFile}`);
               return false;
          }
     } catch(err) {
          console.log(`Error! Unable to check if the file ${recontainRulesFile} exists`);
          exit(1);
     }

     // Validate DefaultComposeDirectory if set
     if (config.has("DefaultComposeDirectory")) {
          if (typeof config.get("DefaultComposeDirectory") !== "string") {
               console.log(`ERROR! The configuration file config${delimiter}default.json has an invalid value for DefaultComposeDirectory`);
               return false;
          }

          const defaultComposeDirectory = config.get("DefaultComposeDirectory");

          if (defaultComposeDirectory.length === 0) {
               console.log(`ERROR! The configuration file config${delimiter}default.json has an empty string for DefaultComposeDirectory`);
               return false;
          }

          try {
               if (!fs.existsSync(defaultComposeDirectory)) {
                    console.log(`Error! Unable to locate the default compose directory ${defaultComposeDirectory}`);
                    return false;
               }
          } catch(err) {
               console.log(`Error! Unable to check if the default compose directory ${defaultComposeDirectory} exists`);
               return false;
          }
     }

     if (!config.has("Silent")) {
          console.log(`ERROR! The configuration file config${delimiter}default.json is missing the definition for Silent`);
          return false;
     }

     if (typeof config.get("Silent") !== "boolean") {
          console.log(`ERROR! The configuration file config${delimiter}default.json has an invalid value for Silent. It must be true or false`);
          return false;
     }

     // Validate UsePodman if set
     if (config.has("UsePodman") && typeof config.get("UsePodman") !== "boolean") {
          console.log(`ERROR! The configuration file config${delimiter}default.json has an invalid value for UsePodman. It must be true or false`);
          return false;
     }

     if (config.has("RuleActionBehavior")) {
          const ruleActionBehavior = config.get("RuleActionBehavior");

          if (typeof ruleActionBehavior !== "string" || (ruleActionBehavior=== ruleActionBehaviorState.none && ruleActionBehavior !== ruleActionBehaviorState.stop && ruleActionBehaviorState.stopDelete)) {
               console.log(`ERROR! The configuration file config${delimiter}default.json has an invalid value for RuleActionBehavior`);
               return false;
          }
     }

     // Validate DefaultEditor if set
     if (config.has("DefaultEditor")) {
          if (typeof config.get("DefaultEditor") !== "string") {
               console.log(`ERROR! The configuration file config${delimiter}default.json has an invalid value for DefaultEditor. It must be point to an editor.`);
               return false;
          }

          const defaultEditor = config.get("DefaultEditor");

          // Validate that the default editor exists
          commandExists(defaultEditor, function(err, commandExists) {
               if (!commandExists) {
                    console.log(`ERROR! Unable to locate the default editor ${defaultEditor}!`);
                    return false;
               } 
          });
     }

     // This method is called without the rule name. If the rule name was not provided, do not do any further validation
     if (ruleName == "") {
          return true;
     }

     const ruleColumnNames = Object.keys(ruleColumns);
 
     const rules = require(recontainRulesFile);
 
     if (typeof rules !== "object") {
          console.log(`ERROR! An error occurred getting the rule names in validateRecontainRules(). Rules is ${typeof rules}`);
          return false;
     }

     if (typeof rules[ruleName] !== "object") {
          console.log(`ERROR! The rule name ${ruleName} is not valid!`);
          return;
     }

     const ruleObj = rules[ruleName];

     if (typeof ruleObj !== "object") {
          console.log(`ERROR! An error occurred getting the rule names in validateRecontainRules(). Rules is ${typeof rules} when the rule name is ${ruleName}`);
          return false;
     }
 
     for (let i=0;i<ruleColumnNames.length;i++) {
          if (ruleColumns[ruleColumnNames[i]].Required === true && typeof ruleObj[ruleColumnNames[i]] === "undefined") {
               console.log(`ERROR! The rule ${ruleName} is missing the attribute ${ruleColumnNames[i]} in the Recontain rules file ${recontainRulesFile} `);
               return false;
          }
     }
 
     if (ruleObj["Containers"].length === 0) {
           console.log(`ERROR! The rule ${ruleName} does not have any containers defined in the Recontain rules file ${recontainRulesFile}`);
           return false;
     }
 
     let fullComposeFilePath = typeof ruleObj.ComposePath !== "undefined" && ruleObj.ComposePath !== "" ? ruleObj.ComposePath : defaultComposeDirectory;
 
     if (fullComposeFilePath.slice(-1) !== delimiter) {
          fullComposeFilePath+=delimiter;
     }
 
     if (!fs.existsSync(fullComposeFilePath + ruleObj.Filename)) {
           console.log(`ERROR! The rule ${ruleName} references the compose file ${fullComposeFilePath + ruleObj.Filename} which does not exist in the Recontain rules file ${recontainRulesFile}`);
           return false;
     }
   
     ruleObj.FullComposeFilePath = fullComposeFilePath;
 
     if (typeof ruleObj.AdditionalComposeFiles !== "undefined") {
          if (ruleObj["AdditionalComposeFiles"].length === 0) {
               console.log(`ERROR! The rule ${ruleName} does not have any additional compose files defined in the Recontain rules file ${recontainRulesFile}`);
               return false;
          }
 
          // Loop through each AdditionalComposeFiles defined in the current object
          for (let i=0;i<ruleObj.AdditionalComposeFiles.length;i++) {
               if (typeof ruleObj.AdditionalComposeFiles[i] !== "string") {
                    console.log(`ERROR! The rule ${ruleName} has an invalid AdditionalComposePath at index ${i} for the rule ${ruleName}. It is ${typeof ruleObj.AdditionalComposeFiles[i]}`);
                    return null;
               }

               if (!fs.existsSync(ruleObj.AdditionalComposeFiles[i])) {
                    console.log(`ERROR! The rule ${ruleName} references the additional compose file ${ruleObj.AdditionalComposeFiles[i]} which does not exist in the Recontain rules file ${recontainRulesFile}`);
                    return false;
               }
          }
     }

     if (typeof ruleObj.AdditionalCommands !== "undefined") {
          if (ruleObj["AdditionalCommands"].length === 0) {
               console.log(`ERROR! The rule ${ruleName} does not have any additional commands files defined in the Recontain rules file ${recontainRulesFile}`);
               return false;
          }
     }

     recontainRulesValidated = true;
	 
     return true;	 
}

// Process command line arguments
if (process.argv.length > 2) {
     const validationResult=validateRecontainRules(process.argv[2]);

     if (!validationResult) {
          exit(1);
     }
 
     runRecontainRule(process.argv[2]);

     exit(0);
}

const entryMethod = getMapProperty("Main Menu","Method");
entryMethod();
