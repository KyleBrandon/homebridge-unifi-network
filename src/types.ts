import { CorporateNetwork, Site } from 'unifi-client';
import { ISystemInfo } from 'unifi-client/lib/SystemInfo/ISystemInfo';

export interface GatewayContext {
    site: Site;
    sysinfo: ISystemInfo;
}

export interface NetworkContext {
    site: Site;
    network: CorporateNetwork;
}

export interface UnifiOptions {
    controller: ControllerOptions;
    networks: string[];
}

export interface ControllerOptions {
    address: string;
    username: string;
    password: string;
    siteName: string;
}
