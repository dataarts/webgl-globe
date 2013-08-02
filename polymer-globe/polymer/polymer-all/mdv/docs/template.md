## Learn the tech

### Why Template Instantiation?

MDV extends the capabilities of the [HTML Template Element](http://www.w3.org/TR/html-templates/). It enables `<template>` to create, manage and remove instances of its content by being bound to JavaScript data.

### Basic usage

#### bind

```html
<template bind="{{ singleton }}">
  Will create a single instance with {{ bindings }} when singleton model data is provided.
</template>
```

#### repeat

```html
<template repeat="{{ collection }}">
  Will create maintain exactly instance with {{ bindings }} for every element in the array collection, when it is provided.
</template>
```

#### if

```html
<template bind if="{{ conditionalValue }}">
  Will bind if and only if conditionalValue is truthy.
</template>

<template if="{{ conditionalValue }}">
  Will bind if and only if conditionalValue is truthy. (same as *bind if*)
</template>

<template repeat if="{{ conditionalValue }}">
  Will repeat if and only if conditionalValue is truthy.
</template>
```

#### ref

```html
<template id="myTemplate">
  Will be used by any template which refers to this one by the ref attribute
</template>

<template bind ref="myTemplate">
  When creating instance, the content of this template will be ignored, and the contnet of #myTemplate will be used instead.
</template>
```

```JavaScript
// Causes any bind, repeat or if attribute directives on #myTemplate to begin acting.
document.getElementById('myTemplate').model = jsData;
```

### API

Note yet written. Please refer to the [HowTo examples](https://github.com/Polymer/mdv/tree/master/examples/how_to).

### Specification

Note yet written. Please refer to the [HowTo examples](https://github.com/Polymer/mdv/tree/master/examples/how_to).

