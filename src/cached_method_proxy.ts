
let Bluebird = require('bluebird');
let debug = require('debug')('cached-method-proxy');
import * as Immutable from 'immutable';
let isPromise = require('is-promise');
let LRU = require('lru-cache');

export interface Options {
    exclude?: Function[]
}

export class CachedFunctionProxy<T extends Function> {
    private cache: any;
    private cacheKeySeq = 0;
    private cacheKeys = Immutable.Map<any, number>();

    call: T;

    constructor(
        private proxiedFunction: T,
        private thisArg?: any
    ) {
        this.call = this.proxyCall.bind(this) as any;
        this.cache = LRU();
    }

    private proxyCall() {
        let args = Array.from(arguments);
        let keyObject = Immutable.fromJS(args);

        let cacheKey = this.cacheKeys.get(keyObject);

        if (cacheKey !== undefined) {
            let cacheRecord = this.getCacheRecord(cacheKey);

            if (cacheRecord !== undefined && cacheRecord.bluebirdPromise !== undefined) {
                // Don't cache rejected promises
                if (!cacheRecord.bluebirdPromise.isRejected()) {
                    return cacheRecord.value;
                }

            } else if (cacheRecord !== undefined) {
                return cacheRecord.value;
            }

        }

        cacheKey = this.cacheKeySeq++;
        this.cacheKeys = this.cacheKeys.set(keyObject, cacheKey);

        let value = this.proxiedFunction.apply(this.thisArg, args);
        this.putCacheRecord(cacheKey, value);
        
        return value;

    };

    clear() {
        this.cacheKeys = Immutable.Map<any, number>();
        this.cache.reset();
    }

    private getCacheRecord(key: number) {
        return this.cache.get(key) as CacheRecord;
    }

    private putCacheRecord(key: number, value: any) {
        if (isPromise(value)) {
            this.cache.set(key, {
                value: value,
                bluebirdPromise: Bluebird.resolve(value)
            });
        } else {
            this.cache.set(key, { value });
        }
    }
}

export class CachedMethodProxy<T> {
    private methodProxies: Map<string | number | Symbol, CachedFunctionProxy<any>>;
    private excludedMethods: Set<Function>;

    constructor(
        private proxiedObject: T,
        private options: Options = {}
    ) {
        this.excludedMethods = new Set(options.exclude);

        let self = this;

        this.methodProxies = new Map();

        this.proxy = new Proxy(proxiedObject, {
            get(target, propKey, receiver) {
                const origProp = target[propKey];
                if (typeof origProp !== 'function') {
                    return origProp;

                } else if (!self.checkInclusion(origProp)) {
                    return origProp;
                }

                if (!self.methodProxies.has(propKey)) {
                    debug(`Adding method proxy for method: ${propKey}`);
                    self.methodProxies.set(propKey, new CachedFunctionProxy(origProp, proxiedObject));
                }

                debug(`Returning proxied method: ${propKey}`);
                return self.methodProxies.get(propKey).call;
            }
        });
    }

    proxy: T;

    clear() {
        this.methodProxies.forEach(proxy => proxy.clear());
    }

    private checkInclusion(method: Function) {
        return !this.excludedMethods.has(method);
    }
}

interface CacheRecord {
    value: any;
    bluebirdPromise?: any;
}
