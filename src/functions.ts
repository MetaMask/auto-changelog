//WORKS
// functions.js
const functions = {
    func2: () => "Original func2 value",
    func1: function() {
        return `Result: ${this.func2()}`;
    }
};
export const { func1, func2 } = functions;

/*
DOESN'T WORK

export function func2() {
    return "Original func2 value";
}

export function func1() {
    return `Result: ${func2()}`;
}
    */
