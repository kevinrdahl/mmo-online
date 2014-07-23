import json
import io
import sys
import hashlib

if len(sys.argv) == 2:
	root = sys.argv[1]
else:
	root = '/var/www/'

f = open('checksum.txt', 'r')
hashes = json.loads(f.read())
changed = []
f.close()

for item in hashes:
	f = open(root+item, 'r')
	h = hashlib.sha224(f.read()).hexdigest()
	if (h != hashes[item]):
		hashes[item] = h
		changed.append(item)
	f.close()
	
if len(changed) > 0:
	print 'MODIFIED:'
	for item in changed:
		print('    ' + item)
	
	f = open('checksum.txt', 'w')
	f.write(json.dumps(hashes))
	f.close()
	
	f = open(root+'version/mmoo.txt', 'r')
	j = json.loads(f.read())
	f.close()
	for item in j['info']:
		if (item[0] in changed):
			item[2] += 1
	
	f = open(root+'version/mmoo.txt', 'w')
	f.write(json.dumps(j))
else:
	print 'No changes'
