import * as hapi from "hapi";
export interface IWozuServer extends hapi.Server {
    wozu(): [{}];
}
export declare let server: IWozuServer;
