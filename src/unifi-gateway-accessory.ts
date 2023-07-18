import { API } from 'homebridge';
import { PLATFORM_NAME, PLUGIN_NAME } from './settings';
import { ProtectNetworkPlatform } from './protect-network-platform';
import { NetworkAccessory } from './network-accessory';
import { CorporateNetwork } from 'unifi-client';
import { GatewayContext } from './types';

export class UnifiGatewayAccessory {
    private api: API = this.platform.api;
    public readonly configuredNetworks: { [index: string]: NetworkAccessory } =
        {};

    constructor(
        private readonly platform: ProtectNetworkPlatform,
        private readonly context: GatewayContext,
    ) {
        this.platform.log.debug(
            'Name: %s Model: %s Version: %s',
            this.context.site.name,
            this.context.sysinfo.ubnt_device_type,
            this.context.sysinfo.udm_version,
        );

        /**
         * Updating characteristics values asynchronously.
         */
        setInterval(() => {
            // query the networks in UniFi and update
            this.discoverNetworks()
                .then(() => {
                    this.platform.log.debug(
                        'Successfully setup the UniFi Gateway',
                    );
                })
                .catch((error) => {
                    this.platform.log.debug(
                        'Failed to setup the UniFi Gateway: %s',
                        error,
                    );
                });
        }, 10000);
    }

    private async discoverNetworks(): Promise<void> {
        const networks = await this.context.site.networks.list();
        for (const network of networks.filter((n): n is CorporateNetwork =>
            this.platform.config.networks.includes(n.name),
        )) {
            if (!network._id) {
                this.platform.log.error(
                    'Cannot configure network %s as it has no _id',
                    network.name,
                );
                continue;
            }
            this.configureNetwork(network);
        }
    }

    private configureNetwork(network: CorporateNetwork): void {
        // generate a unique id from the UniFi network identifier
        const uuid = this.api.hap.uuid.generate(network._id);
        this.platform.log.debug(
            'configureNetwork: Network %s with UUID %s',
            network.name,
            uuid,
        );

        let accessory = this.platform.accessories.find(
            (accessory) => accessory.UUID === uuid,
        );
        if (!accessory) {
            // create a new accessory
            accessory = new this.api.platformAccessory(
                network.name + ' Network',
                uuid,
            );

            this.platform.log.debug(
                'Created new accessory %s with UUID %s:',
                accessory.displayName,
                accessory.UUID,
            );

            // link the accessory to your platform
            this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [
                accessory,
            ]);
            this.platform.accessories.push(accessory);
            this.api.updatePlatformAccessories(this.platform.accessories);
        }

        // store a copy of the device object in the `accessory.context`
        // the `context` property can be used to store any data about the accessory you may need
        accessory.context.device = {
            site: this.context.site,
            network: network,
        };

        if (this.configuredNetworks[accessory.UUID]) {
            this.platform.log.debug(
                'Network already configured:',
                network.name,
            );
            return;
        }

        // create the accessory handler for the newly create accessory
        const networkAccessory = new NetworkAccessory(this.platform, accessory);
        this.configuredNetworks[accessory.UUID] = networkAccessory;
    }
}
