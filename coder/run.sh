docker run --rm -d --name coder -v $1:/workspace -v /var/run/docker.sock:/var/run/docker.sock -p 18080:8080 tamuto/devenviron:coder-0.1.0