

exports.addToDropDown = (name, value, selectElement) => {
    selectElement.innerHTML += `<option value="${value}">${name}</option>`
}

exports.sortStringArray = (arr) => {
    // arr must be of form [string_to_sort_by, other_val]
    arr.sort ((a, b) => {
        var A = a[0].toUpperCase(); // ignore upper and lowercase
        var B = b[0].toUpperCase(); // ignore upper and lowercase
        if (A < B) {
          return -1
        }
        if (A > B) {
          return 1
        }
        // names must be equal
        return 0
    })
}

exports.clearDropDown = (selectElement, defaultText) => {
    selectElement.innerHTML = `<option value="null">${defaultText}</option>`
}