import json
import io
import sys
import hashlib

if len(sys.argv) == 2:
	root = sys.argv[1]
else:
	root = '/var/www/'
	
fileList = {}

f = open('mmoo.txt', 'r')
j = json.loads(f.read())
f.close()

for item in j['info']:
	f = open(root+item[0], 'r')
	fileList[item[0]] = hashlib.sha224(f.read()).hexdigest()
	f.close()
	
print fileList
	
f = open('checksum.txt', 'w')
f.write(json.dumps(fileList))
f.close()

print 'Success!'
