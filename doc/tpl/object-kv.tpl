{{render.header}}

# {{vars.description}}
<font size="1px"><a href="{{vdf}}{{vd}}/index.html">Summary</a></font>

{{#render.extends}}* A part of {{render.extends}}{{/render.extends}}
{{#render.scope}}* Scope: {{render.scope}}{{/render.scope}}
* Type: Object KV
{{#render.since}}* Since: version {{render.since}}{{/render.since}}

## Paramaters

The index key used as **{{vars.key}}**. The index value must be specified as following.

{{render.value}}

{{#render.content}}
## Information

{{{render.content}}}
{{/render.content}}

{{#render.see}}
## See also

{{{render.see}}}
{{/render.see}}
