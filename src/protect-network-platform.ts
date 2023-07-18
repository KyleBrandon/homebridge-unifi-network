import {
    API,
    Characteristic,
    DynamicPlatformPlugin,
    Logging,
    PlatformAccessory,
    PlatformConfig,
    Service,
} from 'homebridge';
import { ControllerOptions, GatewayContext, UnifiOptions } from './types';
import { Controller, Site } from 'unifi-client';
import { UnifiGatewayAccessory } from './unifi-gateway-accessory';

/*
 * HomebridgePlatform
 * This class is the main constructor for your plugin, this is where you should
 * parse the user config and discover/register accessories with Homebridge.
 */
export class ProtectNetworkPlatform implements DynamicPlatformPlugin {
    public readonly Service: typeof Service;
    public readonly Characteristic: typeof Characteristic;
    public readonly accessories: PlatformAccessory[];
    public readonly log: Logging;
    public readonly config!: UnifiOptions;
    public readonly api: API;
    public readonly configuredGateways: {
        [index: string]: UnifiGatewayAccessory;
    };

    constructor(log: Logging, config: PlatformConfig, api: API) {
        this.log = log;
        this.api = api;
        this.Service = this.api.hap.Service;
        this.Characteristic = this.api.hap.Characteristic;
        this.configuredGateways = {};
        this.accessories = []; // this is used to track restored cached accessories

        if (!config) {
            return;
        }

        this.config = {
            controller: config.controller as ControllerOptions,
            networks: config.networks as string[],
        };

        if (!this.config.controller) {
            this.log.info('No UniFi Protect controllers have been configured.');
            return;
        }

        // We need an address, or there's nothing to do.
        if (!this.config.controller.address) {
            this.log.info('No host or IP address has been configured.');
            return;
        }

        // We need login credentials or we're skipping this one.
        if (
            !this.config.controller.username ||
            !this.config.controller.password
        ) {
            this.log.info(
                'No UniFi Protect login credentials have been configured.',
            );
            return;
        }

        // When this event is fired it means Homebridge has restored all cached accessories from disk.
        // Dynamic Platform plugins should only register new accessories after this event was fired,
        // in order to ensure they weren't added to homebridge already. This event can also be used
        // to start discovery of new accessories.
        this.api.on('didFinishLaunching', () => {
            log.debug('Executed didFinishLaunching callback');

            this.configureUnifiGateways()
                .then(() => {
                    this.log.debug('Successfully configured Unifi Gateway');
                })
                .catch((error) => {
                    this.log.debug(
                        'Failed to configure UniFi Gateway: %s',
                        error,
                    );
                });
        });
    }

    /**
     * This function is invoked when homebridge restores cached accessories from disk at startup.
     * It should be used to setup event handlers for characteristics and update respective values.
     */
    configureAccessory(accessory: PlatformAccessory) {
        this.log.info(
            'Loading accessory from cache: %s - %s',
            accessory.displayName,
            accessory.UUID,
        );

        // add the restored accessory to the accessories cache so we can track if it has already been registered
        this.accessories.push(accessory);
    }

    private async configureUnifiGateways(): Promise<void> {
        // Create our connection to the Protect API.
        const controller = new Controller({
            url: this.config.controller.address,
            username: this.config.controller.username,
            password: this.config.controller.password,
            strictSSL: false,
        });

        await controller.login();

        const sites = await controller.getSites();
        const site = sites.find(
            (site) => site.name === this.config.controller.siteName,
        );
        if (!site) {
            throw new Error(
                `Site "${this.config.controller.siteName}" not found in controller`,
            );
        }

        this.configureGateway(site);
    }

    private async configureGateway(site: Site): Promise<void> {
        const sysinfo = await site.getSystemInfo();
        const gatewayContext: GatewayContext = {
            site: site,
            sysinfo: sysinfo,
        };

        // if we've already configure the gateway, then we don't need to do it again.
        if (this.configuredGateways[site._id]) {
            this.log.debug('Gateway already configured:', site.name);
            return;
        }

        this.configuredGateways[site._id] = new UnifiGatewayAccessory(
            this,
            gatewayContext,
        );
    }
}
