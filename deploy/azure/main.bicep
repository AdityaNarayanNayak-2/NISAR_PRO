// NISAR Pro on one Azure VM: engine, gateway and dashboard in a container, scenes and results on
// a separate managed disk that is kept when the VM is deleted.
// Build the template the "Deploy to Azure" button uses:  az bicep build --file main.bicep --outfile azuredeploy.json

@description('Name for the VM and its resources.')
param vmName string = 'nisar-pro'

@description('Central India keeps data in India.')
param location string = resourceGroup().location

@description('4 vCPU and 8 GB run one full L-band scene pair in about a minute.')
@allowed(['Standard_F4s_v2', 'Standard_D4as_v5', 'Standard_D4s_v5', 'Standard_F8s_v2', 'Standard_D8as_v5'])
param vmSize string = 'Standard_F4s_v2'

@description('Spot capacity costs less; Azure may deallocate the VM, and a run in progress must be started again.')
param useSpot bool = false

@description('Scenes (L about 7 GB, S about 12.6 GB each) and results.')
@minValue(32)
param dataDiskGB int = 200

param adminUsername string = 'nisar'

@description('Your SSH public key (ssh-ed25519 ... or ssh-rsa ...). Azure requires one; port 22 stays closed unless sshCidr is set.')
param sshPublicKey string

@description('Open SSH to this range, e.g. 203.0.113.7/32 (empty = closed).')
param sshCidr string = ''

@description('Open port 80 to this range, e.g. 203.0.113.0/24 or * (empty = no public port). Set loginPassword too.')
param publicCidr string = ''

@description('Login password for user admin (empty = no login). Needed with a public port.')
@secure()
param loginPassword string = ''

@description('Optional. HTTPS on your own domain with no open port; route the tunnel to http://localhost:3000.')
@secure()
param cloudflareTunnelToken string = ''

@description('Optional NASA Earthdata token for downloading scenes in the app.')
@secure()
param earthdataToken string = ''

@description('Deallocate the VM after this many minutes with no user and no run (0 = never). Gives the VM a managed identity allowed to stop itself; deploying that needs Owner or User Access Administrator.')
@minValue(0)
param idleStopMinutes int = 0

@description('Optional daily shutdown at this time, India Standard Time, e.g. 2300.')
param autoShutdownTime string = ''

param image string = 'ghcr.io/adityanarayannayak-2/nisar-pro:main'
param installScriptUrl string = 'https://raw.githubusercontent.com/AdityaNarayanNayak-2/NISAR_PRO/main/deploy/vm/install.sh'

var login = empty(loginPassword) ? '' : 'admin:${loginPassword}'
var selfStop = idleStopMinutes > 0
var publicPort = empty(publicCidr) ? '' : '80'
var vmContributor = '9980e02c-c2be-4d73-94e8-173b1dc7cf3c'

// Boot script. Settings arrive base64 encoded so no value can break the quoting.
var boot = '''#!/bin/bash
set -euo pipefail
d() ( echo "$1" | base64 -d )
NISAR_BASIC_AUTH=$(d '{0}'); export NISAR_BASIC_AUTH
CLOUDFLARE_TUNNEL_TOKEN=$(d '{1}'); export CLOUDFLARE_TUNNEL_TOKEN
EARTHDATA_TOKEN=$(d '{2}'); export EARTHDATA_TOKEN
export NISAR_IMAGE='{3}' NISAR_DATA_DEVICE=auto NISAR_PUBLIC_PORT='{4}' NISAR_STOP_MODE=azure-deallocate
if [ '{5}' != 0 ]; then export NISAR_IDLE_STOP_MINUTES='{5}'; fi
curl -fsSL '{6}' -o /root/nisar-install.sh
bash /root/nisar-install.sh
'''

var appRule = [
  {
    name: 'app'
    properties: {
      priority: 100
      direction: 'Inbound'
      access: 'Allow'
      protocol: 'Tcp'
      sourceAddressPrefix: publicCidr
      sourcePortRange: '*'
      destinationAddressPrefix: '*'
      destinationPortRange: '80'
    }
  }
]
var sshRule = [
  {
    name: 'ssh'
    properties: {
      priority: 110
      direction: 'Inbound'
      access: 'Allow'
      protocol: 'Tcp'
      sourceAddressPrefix: sshCidr
      sourcePortRange: '*'
      destinationAddressPrefix: '*'
      destinationPortRange: '22'
    }
  }
]

resource nsg 'Microsoft.Network/networkSecurityGroups@2023-09-01' = {
  name: '${vmName}-nsg'
  location: location
  properties: {
    securityRules: concat(empty(publicCidr) ? [] : appRule, empty(sshCidr) ? [] : sshRule)
  }
}

resource vnet 'Microsoft.Network/virtualNetworks@2023-09-01' = {
  name: '${vmName}-vnet'
  location: location
  properties: {
    addressSpace: { addressPrefixes: ['10.40.0.0/16'] }
    subnets: [
      {
        name: 'default'
        properties: {
          addressPrefix: '10.40.0.0/24'
          networkSecurityGroup: { id: nsg.id }
        }
      }
    ]
  }
}

// A public IP gives the VM outbound internet (NASA ASF, image registry). Inbound is closed by the NSG
// unless publicCidr or sshCidr is set.
resource pip 'Microsoft.Network/publicIPAddresses@2023-09-01' = {
  name: '${vmName}-ip'
  location: location
  sku: { name: 'Standard' }
  properties: { publicIPAllocationMethod: 'Static' }
}

resource nic 'Microsoft.Network/networkInterfaces@2023-09-01' = {
  name: '${vmName}-nic'
  location: location
  properties: {
    ipConfigurations: [
      {
        name: 'ipconfig1'
        properties: {
          privateIPAllocationMethod: 'Dynamic'
          subnet: { id: vnet.properties.subnets[0].id }
          publicIPAddress: { id: pip.id }
        }
      }
    ]
  }
}

resource vm 'Microsoft.Compute/virtualMachines@2024-07-01' = {
  name: vmName
  location: location
  identity: selfStop ? { type: 'SystemAssigned' } : null
  properties: {
    hardwareProfile: { vmSize: vmSize }
    priority: useSpot ? 'Spot' : 'Regular'
    evictionPolicy: useSpot ? 'Deallocate' : null
    billingProfile: useSpot ? { maxPrice: -1 } : null
    storageProfile: {
      imageReference: {
        publisher: 'Canonical'
        offer: 'ubuntu-24_04-lts'
        sku: 'server'
        version: 'latest'
      }
      osDisk: {
        createOption: 'FromImage'
        diskSizeGB: 30
        managedDisk: { storageAccountType: 'StandardSSD_LRS' }
        deleteOption: 'Delete'
      }
      dataDisks: [
        {
          lun: 0
          name: '${vmName}-data'
          createOption: 'Empty'
          diskSizeGB: dataDiskGB
          managedDisk: { storageAccountType: 'StandardSSD_LRS' }
          deleteOption: 'Detach'
        }
      ]
    }
    osProfile: {
      computerName: vmName
      adminUsername: adminUsername
      customData: base64(format(boot, base64(login), base64(cloudflareTunnelToken), base64(earthdataToken), image, publicPort, string(idleStopMinutes), installScriptUrl))
      linuxConfiguration: {
        disablePasswordAuthentication: true
        ssh: {
          publicKeys: [
            {
              path: '/home/${adminUsername}/.ssh/authorized_keys'
              keyData: sshPublicKey
            }
          ]
        }
      }
    }
    networkProfile: {
      networkInterfaces: [
        {
          id: nic.id
          properties: { deleteOption: 'Delete' }
        }
      ]
    }
    securityProfile: {
      securityType: 'TrustedLaunch'
      uefiSettings: { secureBootEnabled: true, vTpmEnabled: true }
    }
  }
}

// Lets the idle check deallocate this VM (a powered-off Azure VM is still billed).
resource selfStopRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = if (selfStop) {
  name: guid(vm.id, 'self-stop')
  scope: vm
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', vmContributor)
    principalId: selfStop ? vm.identity.principalId : ''
    principalType: 'ServicePrincipal'
  }
}

resource shutdown 'Microsoft.DevTestLab/schedules@2018-09-15' = if (!empty(autoShutdownTime)) {
  name: 'shutdown-computevm-${vmName}'
  location: location
  properties: {
    status: 'Enabled'
    taskType: 'ComputeVmShutdownTask'
    dailyRecurrence: { time: empty(autoShutdownTime) ? '2300' : autoShutdownTime }
    timeZoneId: 'India Standard Time'
    targetResourceId: vm.id
    notificationSettings: { status: 'Disabled' }
  }
}

output publicIp string = pip.properties.ipAddress
output appUrl string = empty(publicCidr) ? 'No public port. Use sshTunnel or your Cloudflare Tunnel hostname.' : 'http://${pip.properties.ipAddress}/app'
output sshTunnel string = empty(sshCidr) ? 'SSH closed (set sshCidr to open it).' : 'ssh -L 3000:127.0.0.1:${empty(publicCidr) ? '3000' : '80'} ${adminUsername}@${pip.properties.ipAddress}   then open http://localhost:3000/app'
