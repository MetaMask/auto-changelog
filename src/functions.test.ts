import * as Functions from './functions';

describe('func1', () => {
    it('returns the mocked value of func2 when called', () => {
        // Spy on func2 and mock its return value
        const spy = jest.spyOn(Functions, 'func2').mockReturnValue("Mocked func2 value");

        // Call func1, which internally calls the mocked func2
        const result = Functions.func1();

        // Verify that the mocked version of func2 is called
        expect(result).toBe("Result: Mocked func2 value");
        expect(spy).toHaveBeenCalled();
    });
});
