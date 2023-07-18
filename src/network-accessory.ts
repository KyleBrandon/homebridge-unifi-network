import { Service, PlatformAccessory, CharacteristicValue } from 'homebridge';
import { ProtectNetworkPlatform } from './protect-network-platform';
import { Site, CorporateNetwork } from 'unifi-client';
import { NetworkContext } from './types';

/**
 * Network Accessory
 * An instance of this class is created for each Network in UniFi.
 */
export class NetworkAccessory {
    private service: Service;

    constructor(
        private readonly platform: ProtectNetworkPlatform,
        private readonly accessory: PlatformAccessory,
    ) {
        // set accessory information
        const platformAccessory = this.accessory.getService(
            this.platform.Service.AccessoryInformation,
        );
        if (platformAccessory) {
            platformAccessory.setCharacteristic(
                this.platform.Characteristic.Manufacturer,
                'Ubiquiti Networks',
            );
        }

        // get the Switch service if it exists, otherwise create a new Switch service
        this.service =
            this.accessory.getService(this.platform.Service.Switch) ||
            this.accessory.addService(this.platform.Service.Switch);

        // set the service name, this is what is displayed as the default name on the Home app
        // in this example we are using the name we stored in the `accessory.context` in the `discoverDevices` method.
        this.service.setCharacteristic(
            this.platform.Characteristic.Name,
            this.accessory.displayName,
        );

        // register handlers for the On/Off Characteristic
        this.service
            .getCharacteristic(this.platform.Characteristic.On)
            .onSet(this.setOn.bind(this)) // SET - bind to the `setOn` method below
            .onGet(this.getOn.bind(this)); // GET - bind to the `getOn` method below

        /**
         * Updating characteristics values asynchronously.
         */
        setInterval(() => {
            const context: NetworkContext = this.accessory.context.device;
            this.platform.log.debug(
                'Is network "%s" enabled: %s',
                context.network.name,
                context.network.enabled ? 'Yes' : 'No',
            );

            // query the networks in UniFi and update
            this.getNetwork(context.site, context.network._id).then(
                (network) => {
                    context.network.enabled = network.enabled;
                    this.service.updateCharacteristic(
                        this.platform.Characteristic.On,
                        network.enabled,
                    );
                },
            );
        }, 10000);
    }

    async getNetwork(site: Site, id: string): Promise<CorporateNetwork> {
        const networks = await site.networks.list();
        const [network] = networks.filter(
            (n): n is CorporateNetwork => n._id === id,
        );
        return network;
    }

    /**
     * Handle "SET" requests from HomeKit
     */
    async setOn(value: CharacteristicValue) {
        const context: NetworkContext = this.accessory.context.device;
        context.network.enabled = Boolean(value);
        this.platform.log.debug(
            'Set network "%s" enabled to: %s',
            context.network.name,
            context.network.enabled,
        );
        const network = await this.getNetwork(
            context.site,
            context.network._id,
        );
        network.enabled = context.network.enabled;
        network.save();
    }

    /**
    * Handle the "GET" requests from HomeKit
    * These are sent when HomeKit wants to know the current state of the accessory, for example, checking if a Light bulb is on.
    *
    * GET requests should return as fast as possbile. A long delay here will result in
    * HomeKit being unresponsive and a bad user experience in general.
    *
    * If your device takes time to respond you should update the status of your device
    * asynchronously instead using the `updateCharacteristic` method instead.

    * @example
    * this.service.updateCharacteristic(this.platform.Characteristic.On, true)
    */
    async getOn(): Promise<CharacteristicValue> {
        const context: NetworkContext = this.accessory.context.device;

        this.platform.log.debug(
            'Get network "%s" enabled: %s',
            context.network.name,
            context.network.enabled,
        );
        return Boolean(context.network.enabled);
    }
}
