#!/bin/bash
# ~/dev/homebridge-infinitive/deploy-infinitive.sh
cd ~/dev/homebridge-infinitive
git pull
npm install
npm run build
# we created symlinks, so now don't need to copy
# sudo rm -rf /var/lib/homebridge/node_modules/homebridge-infinitive
# sudo cp -r ~/dev/homebridge-infinitive /var/lib/homebridge/node_modules/
# sudo chown -R homebridge:homebridge /var/lib/homebridge/node_modules/homebridge-infinitive
sudo hb-service restart
