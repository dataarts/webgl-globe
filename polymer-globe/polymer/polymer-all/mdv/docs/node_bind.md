## Learn the tech

### Why Node.prototype.bind?

MDV adds a `bind()` method to all DOM nodes which instructs them bind the named value to the data provided. The meaning of the binding name is interpreted by the node on which it is called.

`Text` node only handles the 'textContent' binding. `HTMLInputElement` handles the 'value' and 'checked' bindings as two-way. All other elements handles bindings as to attributes. 
### Basic usage

#### Text

```JavaScript
textNode.bind('textContent', someObj, 'path.to.value');
```

Instructs the `Text` node to make its `textContent` dependent on the value `someObj.path.to.value`. Initially, and whenever the value changes, `textContent` will set to `String(someObj.path.to.value)`, or the empty string if the path is `null`, `undefined` or unreachable.

####Element attribute value

```JavaScript
myElement.bind('title', someObj, 'path.to.value');
```

Instructs the element to make the value its `title` attribute dependent on the value `someObj.path.to.value`. Initially, and whenever the value changes, the attribute value will be set to `String(someObj.path.to.value)`, or the empty string if the path is `null`, `undefined` or unreachable.

####Element attribute presence

```JavaScript
myElement.bind('hidden?', someObj, 'path.to.value');
```

Instructs the element to make the presence of its `hidden` attribute dependent on the vaue `someObj.path.to.value`. Initially, and whenever the value changes, the attribute will be set to the empty string if the value `someObj.path.to.value` is reachable and truthy, otherwise the attribute will be removed.


#### Input Element value and checked properties

```JavaScript
myValueInput.bind('value', someObj, 'path.to.value');
```

Instructs the `input` to ensure the its `value` property is equal to `String(someObje.path.to.value)`. The binding is two-way. Upon binding, if the path reachable, `value` is set to the path value. If the path is unreachable but can be made reachable by setting a single property on the final object, the property is set to `value`.


```JavaScript
myCheckboxOrRadioInput.bind('checked', someObj, 'path.to.value');
```
Instructs the `input` to ensure the its `checked` property is equal to `Boolean(someObje.path.to.value)`. The binding is two-way. Upon binding, if the path reachable, `checked` is set to the path value. If the path is unreachable but can be made reachable by setting a single property on the final object, the property is set to `checked`.

### Custom Element bindings

[Custem Elements](https://dvcs.w3.org/hg/webcomponents/raw-file/tip/spec/custom/index.html) may choose to interpret bindings as they wish. The do this by overriding the `bind` method.

```JavaScript
HTMLMyFancyWidget.prototype.bind = function(name, obj, path) {
  if (name == 'myBinding')
    // interpret the binding meaning
  else
    HTMLElement.prototype.bind.call(this, name, obj, path);
}
```

If the element does not handle the binding, it should give its super class the opportunity to by invoking its `bind` method.


### API

Note yet written. Please refer to the [HowTo examples](https://github.com/Polymer/mdv/tree/master/examples/how_to).

### Specification

Note yet written. Please refer to the [HowTo examples](https://github.com/Polymer/mdv/tree/master/examples/how_to).

