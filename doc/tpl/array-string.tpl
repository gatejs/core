{{render.header}}

# {{vars.description}}
<font size="1px"><a href="{{vdf}}{{vd}}/index.html">Summary</a></font>

{{#render.extends}}* A part of {{render.extends}}{{/render.extends}}
{{#render.scope}}* Scope: {{render.scope}}{{/render.scope}}
* Type: Array string

{{#render.content}}
## Information

{{{render.content}}}
{{/render.content}}

{{#render.see}}
## See also

{{{render.see}}}
{{/render.see}}