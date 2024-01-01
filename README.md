# Recontain
Recontain is a command line application written in JavaScript that lets you manage your Docker or Podman environment and can be run using Node JS or compiled to to run on Windows, Linux and Mac. It is meant to provide the same functionality as Portainer but runs in a command prompt instead of a browser window. 

See the instructions below on how to compile Recontain.

Recontain has an interactive menu that lets you perform the following actions:

1. Manage Containers - Select a docker container and choose to start, stop, restart or delete the container.
1. Manage Images - Inspect an image, Prune unused images, Remove an image, Update an image.
1. Manage Compose Files - All compose files specified in the Recontain rules file along with all compose ifles in the DefaultComposeDirectory (if provided).
1. Manage Networks - Inspect a network, prune unused networks and remove a network
1. Manage volumes - Create a volume
1. Run Recontain rule - Run a recontain rule to recreate multiple containers at once.
1. Run system prune - Runs docker/podman system prune -a to remove all unused containers, images, networks and volumes.

You can also run a recontain rule from the command line and skip the interactive menu entirely.

# Screenshots
![Main Menu](https://raw.githubusercontent.com/SegiH/Recontain/main/Screenshots/MainMenu.png?raw=true)
![Containers](https://raw.githubusercontent.com/SegiH/Recontain/main/Screenshots/Containers.png?raw=true)
![Compose Files](https://raw.githubusercontent.com/SegiH/Recontain/main/Screenshots/ComposeFiles.png?raw=true)
![Images](https://raw.githubusercontent.com/SegiH/Recontain/main/Screenshots/Images.png?raw=true)
![Networks](https://raw.githubusercontent.com/SegiH/Recontain/main/Screenshots/Networks.png?raw=true)
![Prune](https://raw.githubusercontent.com/SegiH/Recontain/main/Screenshots/Prune.png?raw=true)
![Recontain Rules](https://raw.githubusercontent.com/SegiH/Recontain/main/Screenshots/RecontainRules.png?raw=true)
![Volumes](https://raw.githubusercontent.com/SegiH/Recontain/main/Screenshots/Volumes.png?raw=true)

# Requirements
In order for Recontain to work you must have docker or podman installed. If you plan on creating Recontain rules, you also need to have docker-compose/podman-compose installed.

# Setup
Edit the main config file located in `config/default.json` where you need set a few default values:

Your main config file will look like this:
```
{
     "RecontainRulesFile": "/home/johndoe/Recontain/recontain.json",
     "DefaultComposeDirectory": "/opt/scripts/composeScripts",
     "Silent": false
}
```

RecontainRulesFile (Optional): The full path to the Recontain rules config file that defines your Recontain rules. If you do not set this property, Recontain will look for the Recontain rules config file in the same location as the Recontain executable or recontain.js.

DefaultComposeDirectory (Optional): If you keep all of your compose files in a single directory, you can specify the default location where your compose files are located. Otherwise, set ComposeDir in your Recontain rules file to specify the directory where the compose file is located.

DefaultEditor (Optional): If set, the command program to run when editing a file. If not set this defaults to vi

Silent: If this is set to true, no output will be displayed. Otherwise there will be detailed messages displayed. Error messages will always be displayed no matter what you set silent to.

UsePodman (Optional): Set to true if you want to use Podman instead of Docker

RuleActionBehavior (Optional): When running a rule, the default behavior is to stop and remove all of the existing containers that you define for that rule. You can override it with this setting.

Valid values are:

Do not stop or remove the container(s):
`
"RuleActionBehavior": "none"
`

Stop the container(s) but do not remove it:
`
"RuleActionBehavior": "stop"
`

Stop and remove the container(s):
`
"RuleActionBehavior": "stop-delete"
`
If you do not specify RuleActionBehavior in `config/default.json`, it will default to "stop-delete"

## Create the Recontain rules config file:

# Running Recontain
Recontain can be run with the interactive menu by running:

Run using Node:
`
node recontain.js
`

or if you compiled Recontain into an executable:

```
recontain
```

# Recontain Rules
Recontain rules are rules that you create to define one or more Docker/Podman containers that will be stopped, removed and recreated based on a compose file that you give the full path to.
This can be useful if you want to recreate multiple Docker containers that are in use by a single Docker application with a short, easy to run command based on a given name of your choice.
You only need to create Recontain rules if you want to use this feature. If you don't want to use Recontain rules, you can still use the other menu options besides Run Recontain Rule.

Create a basic json Recontain config file. It might look like this:
```
{
     "WordPress" : {
          "Filename": "wordpress.yml",
          "Port": 80,
          "Containers": [
               "WordPress",
               "WordPress-DB",
               "Redis"
          ]
     },
}
```

The name WordPress can be anything you choose. I would not recommend using a name that has spaces because you would need to use quotation marks around the name at the command line like this "My Apps"

When you want to run a Recontain rule, you can run it by selecting it from the menu or from the command line

Run using Node:

```
node recontain.js WordPress
```

or if you compiled Recontain into an executable:

```
recontain WordPress
```

With this sample config, the following commands will be run automatically:
```
docker stop WordPress
docker rm WordPress
docker stop WordPress-DB
docker rm WordPress-DB
docker stop Redis
docker rm Redis
cd <directory-where-compose-file-is-at>
docker-compose -f wordpress.yml up -d
```

For every additional container, add another block like so:

```
     "WordPress" : {
          "Filename": "wordpress.yml",
          "Port": 80,
          "Containers": [
               "WordPress",
               "WordPress-DB",
               "Redis"
          ]
     },
     "Nextcloud" : {
          "Filename": "nextcloud.yml",
          "Port": 80,
          "Prompt": true,
          "Containers": [
               "Nextcloud",
               "Nextcloud-DB",
               "Redis"
          ],
          AdditionalComposeFiles: [
               "/home/johndoe/composeScripts/compose1.yml",
               "/home/johndoe/composeScripts/compose2.yml"
               "/root/redis.yml"
          ],
          AdditionalCommands: [
               "docker exec <RULENAME_LOWERCASE> apachectl status",
               "docker exec <RULENAME_LOWERCASE> other_command"
          ]
     },
}
```

The properties that you can set for a rule are:

Filename: Required. The compose file that you want to execute to rebuild your docker containers.

Port: Not required but if you do set this, the port number will be displayed when you recreate the container. It can be helpful to keep track what ports are in use by an app.

Prompt: Not required. If this is set to true, you will be prompted to confirm before this rule is run. This defaults to false if it is not set or if it is set and is set it to false,

Containers: Required. You must have at least 1 container defined to recreate.

ComposePath: The path to the compose file. If not given, the default compose directory is used.

For example you would use

```
"ComposePath": "/home/johndoe/wordpress/docker/",
```

AdditionalComposeFiles: Not required. One or more additional compose files that you want to execute. 

AdditionalCommands: Not Required. One or more additional commands that you want to run after your container has been started. You can substitute a few fields in the command.
1. <RULENAME> will substitute the name of the rule assuming it is the same name as your container
1. <RULENAME_LOWERCASE> same as above but the rule name in all lower case
1. <PORT> The port number if you defined one.

# Compiling Recontain
You can compile Recontain for Windows, Mac and Linux. run the commands below:
1. `npm install -g pkg`
1. Linux: `pkg -t node16-linux ./recontain.js`
1. Windows: `pkg -t node16-win ./recontain.js`
1. Mac: `pkg -t node16-macos-x64 ./recontain.js`
1. Make sure that your config folder is located in the same location as the executable

If you see an error that says: "Warning Cannot resolve 'recontainRulesFile'", you can ignore it

# Known Issues

When you compile Recontain, the config folder has to be in the current folder that you are executing Recontain from.

