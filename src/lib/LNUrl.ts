import { useState, useEffect } from "react";
import { Event as NostrEvent } from "nostr-tools";

import { bech32ToText } from "../nostr";

interface LNURLService {
  nostrPubkey?: string;
  minSendable?: number;
  maxSendable?: number;
  metadata: string;
  callback: string;
  commentAllowed?: number;
}

async function fetchJson<T>(url: string) {
  const rsp = await fetch(url);
  if (rsp.ok) {
    const data: T = await rsp.json();
    console.log(data);
    return data;
  }
  return null;
}

export async function loadService(
  service?: string
): Promise<LNURLService | null> {
  if (service) {
    const isServiceUrl = service.toLowerCase().startsWith("lnurl");
    if (isServiceUrl) {
      const serviceUrl = bech32ToText(service);
      return await fetchJson(serviceUrl);
    } else {
      const ns = service.split("@");
      return await fetchJson(`https://${ns[1]}/.well-known/lnurlp/${ns[0]}`);
    }
  }
  return null;
}

export function useLnURLService(srv?: string) {
  const [service, setService] = useState<LNURLService | undefined>();
  useEffect(() => {
    loadService(srv).then((s) => {
      if (s) {
        setService(s);
      }
    });
  }, [srv]);
  return service;
}

export async function loadInvoice(
  payService: LNURLService,
  amount: number,
  comment?: string,
  nostr?: NostrEvent
) {
  if (!amount || !payService) return null;

  const callback = new URL(payService.callback);
  const query = new Map<string, string>();
  if (callback.search.length > 0) {
    callback.search
      .slice(1)
      .split("&")
      .forEach((a) => {
        const pSplit = a.split("=");
        query.set(pSplit[0], pSplit[1]);
      });
  }
  query.set("amount", Math.floor(amount * 1000).toString());
  if (comment && payService?.commentAllowed) {
    query.set("comment", comment);
  }
  if (payService.nostrPubkey && nostr) {
    query.set("nostr", JSON.stringify(nostr));
  }

  const baseUrl = `${callback.protocol}//${callback.host}${callback.pathname}`;
  // @ts-ignore
  const queryJoined = [...query.entries()]
    .map((v) => `${v[0]}=${encodeURIComponent(v[1])}`)
    .join("&");
  try {
    const rsp = await fetch(`${baseUrl}?${queryJoined}`);
    if (rsp.ok) {
      const data = await rsp.json();
      console.log(data);
      if (data.status === "ERROR") {
        throw new Error(data.reason);
      } else {
        return data;
      }
    }
  } catch (e) {
    console.error(e);
  }
}
