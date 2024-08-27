import { BG } from "bgutils-js";
import { JSDOM } from "jsdom";
import * as cp from "child_process";
import util from "util";

interface YoutubeSessionData {
  poToken: string;
  visitorData: string;
  generatedAt: Date;
}

export class SessionManager {
  private youtubeSessionData: YoutubeSessionData | undefined;

  // mostly copied from https://github.com/LuanRT/BgUtils/tree/main/examples/node
  async generatePoToken(visitorData: string): Promise<YoutubeSessionData> {
    if (
      this.youtubeSessionData &&
      this.youtubeSessionData.generatedAt >
        new Date(new Date().getTime() - 6 * 60 * 60 * 1000)
    ) {
      return this.youtubeSessionData;
    }

    // hardcoded API key that has been used by youtube for years
    const requestKey = "O43z0dpjhgX20SCx4KAo";
    const dom = new JSDOM();

    globalThis.window = dom.window as any;
    globalThis.document = dom.window.document;

    const bgConfig = {
      fetch: (url: any, options: any) => fetch(url, options),
      globalObj: globalThis,
      identity: visitorData,
      requestKey,
    };

    const challenge = await BG.Challenge.create(bgConfig);

    if (!challenge) throw new Error("Could not get challenge");

    if (challenge.script) {
      const script = challenge.script.find((sc) => sc !== null);
      if (script) new Function(script)();
    } else {
      console.warn("Unable to load Botguard.");
    }

    const poToken = await BG.PoToken.generate({
      program: challenge.challenge,
      globalName: challenge.globalName,
      bgConfig,
    });

    console.info("po_token:", poToken);
    console.info("visitor_data:", visitorData);

    if (!poToken) {
      throw new Error("po_token unexpected undefined");
    }

    this.youtubeSessionData = {
      visitorData: visitorData,
      poToken: poToken,
      generatedAt: new Date(),
    };

    return this.youtubeSessionData;
  }
}
