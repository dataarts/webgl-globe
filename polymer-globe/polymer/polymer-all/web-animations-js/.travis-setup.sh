#! /bin/sh

# Make sure /dev/shm has correct permissions.
ls -l /dev/shm
sudo chmod 1777 /dev/shm
ls -l /dev/shm

# Install python-imaging from the environment rather then build it.
# If the below fails, pip will build it via the .requirements
sudo apt-get install python-imaging
VIRTUAL_ENV_site_packages=$(echo $VIRTUAL_ENV/lib/*/site-packages)
VIRTUAL_ENV_python_version=$(echo $VIRTUAL_ENV_site_packages | sed -e's@.*/\(.*\)/site-packages@\1@')
ln -s /usr/lib/$VIRTUAL_ENV_python_version/dist-packages/PIL.pth $VIRTUAL_ENV_site_packages/PIL.pth
ln -s /usr/lib/$VIRTUAL_ENV_python_version/dist-packages/PIL $VIRTUAL_ENV_site_packages/PIL

case $BROWSER in
Chrome*)
	export VERSION=$(echo $BROWSER | sed -e's/[^-]*-//')
	export BROWSER=$(echo $BROWSER | sed -e's/-.*//')
	echo "Getting $VERSION of $BROWSER"
	export CHROME=google-chrome-${VERSION}_current_amd64.deb
	wget https://dl.google.com/linux/direct/$CHROME
	sudo dpkg --install $CHROME || sudo apt-get -f install
	ls -l /usr/bin/google-chrome
	google-chrome --version
	;;

Firefox)
	firefox --version
	;;
esac

pip install -r .requirements --use-mirrors
