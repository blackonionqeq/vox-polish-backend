curl -o genshin_words2.json https://dataset.genshin-dictionary.com/words.json

rm -rf genshin_words.json

mv genshin_words2.json genshin_words.json

echo "Updated genshin_words.json"
echo "Done"
echo "Please run 'pnpm run import:words' to import the new words to the database"