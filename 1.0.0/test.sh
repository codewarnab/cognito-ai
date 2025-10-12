cd model/1.0.0
for f in *; do
  echo "$f: $(stat -c%s "$f") bytes"
  sha256sum "$f"
done
