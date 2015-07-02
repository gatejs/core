{{render.header}}

# {{vars.description}}
<font size="1px"><a href="{{vdf}}{{vd}}/index.html">Summary</a></font>

{{#render.extends}}* A part of {{render.extends}}{{/render.extends}}
{{#render.scope}}* Scope: {{render.scope}}{{/render.scope}}
* Type: Object Options
{{#render.since}}* Since: version {{render.since}}{{/render.since}}

{{#render.params}}
## Parameters

{{{render.params}}}
{{/render.params}}

{{#render.content}}
## Information

{{{render.content}}}
{{/render.content}}

{{#render.see}}
## See also

{{{render.see}}}
{{/render.see}}
