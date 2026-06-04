import re

html = open('/home/rober/Documentos/Prode/Seguridad/2026-06-03-ZAP-Report-.html').read()

# Look for text like "Medium (Warning)" or specific alert titles.
# A simple way to get headers is looking for <h3... or <tr class="risk-...
import xml.etree.ElementTree as ET

# Since HTML might not be well-formed XML, let's use regex to find the summary items
# Usually in ZAP report, there is a summary table with risk levels.
# Also there are alerts listed like: <a href="#alert-type-X">Alert Name</a>
alerts = re.findall(r'<a href="#alert-type-\d+">([^<]+)</a>', html)
print("ALERTS FOUND:")
for alert in set(alerts):
    print("- " + alert)

print("\nRISK LEVELS:")
# Let's find occurrences of High, Medium, Low, Informational
for risk in ['High', 'Medium', 'Low', 'Informational']:
    count = html.count('>' + risk + '<')
    if count == 0: count = html.count('>' + risk)
    print(f"{risk}: {count}")

