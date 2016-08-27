
import * as chai from 'chai';
import * as chaiAsPromised from 'chai-as-promised';

import {
    CachedMethodProxy,
    CachedFunctionProxy
} from '../cached_method_proxy';

chai.use(chaiAsPromised);

let expect = chai.expect;

class TestClass1 {
    private callCount = 0;

    constructor(
    ) {
    }

    getCallCount() {
        return this.callCount;
    }

    getPrimitiveWithoutArguments() {
        this.callCount++;
        return 1;
    }

    getPrimitiveWithPrimitiveArgument(a: number) {
        this.callCount++;
        return a + 1;
    }

    getAnotherPrimitiveWithPrimitiveArgument(a: number) {
        this.callCount++;
        return a + 2;
    }

    getPrimitiveWithComplexArgument(a: { name: string, list: number[] }) {
        this.callCount++;
        return "_" + a.name;
    }

    getComplexValue() {
        this.callCount++;
        return { a: 1, b: [2, 'a'] };
    }

    asyncSum(a: number, b: number) {
        this.callCount++;
        return Promise.resolve(a + b);
    }

    getRejectedPromise() {
        this.callCount++;
        return Promise.reject("error");
    }

}

describe("Cached method proxy", function () {
    let testObject: TestClass1;
    let proxy: TestClass1;

    beforeEach(function () {
        testObject = new TestClass1();
        proxy = new CachedMethodProxy(testObject).proxy;
    });

    it("should proxy method calls with no arguments returning a primitive", function () {
        let v1 = proxy.getPrimitiveWithoutArguments();
        let v2 = proxy.getPrimitiveWithoutArguments();

        expect(testObject.getCallCount()).to.equal(1);

        let expectedValue = testObject.getPrimitiveWithoutArguments();
        expect(v1).to.equal(expectedValue);
        expect(v2).to.equal(expectedValue);
    });
    
    it("should proxy method calls with a primitive argument", function () {
        let v1 = proxy.getPrimitiveWithPrimitiveArgument(4);
        let v2 = proxy.getPrimitiveWithPrimitiveArgument(4);
        let v3 = proxy.getPrimitiveWithPrimitiveArgument(2);

        expect(testObject.getCallCount()).to.equal(2);

        let expectedValue = testObject.getPrimitiveWithPrimitiveArgument(4);
        expect(v1).to.equal(expectedValue);
        expect(v2).to.equal(expectedValue);
        expect(v3).to.equal(testObject.getPrimitiveWithPrimitiveArgument(2));
    });

    it("should proxy method calls with complex arguments", function () {
        let v1 = proxy.getPrimitiveWithComplexArgument({ name: 'a', list: [1, 2] });
        let v2 = proxy.getPrimitiveWithComplexArgument({ name: 'a', list: [1, 2] });

        expect(testObject.getCallCount()).to.equal(1);

        let expectedValue = testObject.getPrimitiveWithComplexArgument({ name: 'a', list: [1, 2] });
        expect(v1).to.equal(expectedValue);
        expect(v2).to.equal(expectedValue);
    });

    it("should vary by complex argument differences", function () {
        let v1 = proxy.getPrimitiveWithComplexArgument({ name: 'a', list: [1, 2] });
        let v2 = proxy.getPrimitiveWithComplexArgument({ name: 'a', list: [1, 3] });

        expect(testObject.getCallCount()).to.equal(2);

        expect(v1).to.equal(testObject.getPrimitiveWithComplexArgument({ name: 'a', list: [1, 2] }));
        expect(v2).to.equal(testObject.getPrimitiveWithComplexArgument({ name: 'a', list: [1, 3] }));
    });

    it("should proxy method calls returning complex values", function () {
        let v1 = proxy.getComplexValue();
        let v2 = proxy.getComplexValue();

        expect(testObject.getCallCount()).to.equal(1);

        let expectedValue = testObject.getComplexValue();
        expect(v1).to.deep.equal(expectedValue);
        expect(v2).to.deep.equal(expectedValue);
        expect(v1).to.equal(v2);
    });

    it("should distinguish methods by name", function () {
        let v1 = proxy.getPrimitiveWithPrimitiveArgument(4);
        let v2 = proxy.getAnotherPrimitiveWithPrimitiveArgument(4);

        expect(testObject.getCallCount()).to.equal(2);

        expect(v1).to.equal(testObject.getPrimitiveWithPrimitiveArgument(4));
        expect(v2).to.equal(testObject.getAnotherPrimitiveWithPrimitiveArgument(4));
    });

    it("should proxy methods returning a promise for a primitive", async function () {
        let v1Promise = proxy.asyncSum(4, 7);
        let v2Promise = proxy.asyncSum(4, 7);

        expect(v1Promise).to.equal(v2Promise);

        let v1 = await v1Promise;
        let v2 = await v2Promise;

        expect(testObject.getCallCount()).to.equal(1);

        let expectedValue = await testObject.asyncSum(4, 7);
        expect(v1).to.equal(expectedValue);
        expect(v2).to.equal(expectedValue);
    });

    it("should not cache rejected promises", async function () {
        let v1Promise = proxy.getRejectedPromise();
        let v2Promise = proxy.getRejectedPromise();

        expect(v1Promise).to.equal(v2Promise);
        expect(testObject.getCallCount()).to.equal(1);

        await expect(v1Promise).to.be.eventually.rejectedWith("error"); 

        let v3Promise = proxy.getRejectedPromise();

        //expect(v3Promise).to.not.equal(v1Promise);
        expect(testObject.getCallCount()).to.equal(2);
    });

    it("should allow excluding methods", function () {
        proxy = new CachedMethodProxy(testObject, { exclude: [testObject.getPrimitiveWithoutArguments]}).proxy;

        let v1 = proxy.getPrimitiveWithoutArguments();
        let v2 = proxy.getPrimitiveWithoutArguments();

        expect(testObject.getCallCount()).to.equal(2);

        proxy.getComplexValue();
        proxy.getComplexValue();

        expect(testObject.getCallCount()).to.equal(3);

        expect(v1).to.equal(testObject.getPrimitiveWithoutArguments());
        expect(v2).to.equal(v1);
    });
});



