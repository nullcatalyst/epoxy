# epoxy

> Separation of concerns does not mean separation of technologies.

This little tool is designed to make it easy to create reusable web components.

Inspired by the way [React](https://facebook.github.io/react/) uses JSX files to combine HTML and JavaScript that are related, you would use [Epoxy](https://github.com/nullcatalyst/epoxy) to take that one step further and combine HTML, CSS and JS. Epoxy loads and watches a library of XML files containing the aforementioned components and combines them into a single output HTML file containing only the parts that are needed.

Currently, the goal is to start by creating a tool that makes it very easy to create staticly generated sites that are easier to maintain and make changes over the life of the site.

## Example

```html
<style>
</style>

<script>
</script>

<template>
    <html>
        <head>
            <title>Example</title>

            <!-- Insert the combined styles here -->
            <Styles />
        </head>
        <body>

            <!-- Insert the combined scripts here -->
            <Scripts />
        </body>
    </html>
</template>
```
